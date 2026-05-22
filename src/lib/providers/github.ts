import { Octokit } from 'octokit';

function getOctokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

const OWNER = () => process.env.GITHUB_OWNER!;
const REPO  = () => process.env.GITHUB_REPO!;

// ── Ensure a release exists for uploads (creates if not found) ─────────────
async function ensureUploadRelease(octokit: Octokit): Promise<{
  id:          number;
  upload_url:  string;
  tag_name:    string;
}> {
  const tag = 'fileflow-uploads';

  try {
    const { data } = await octokit.rest.repos.getReleaseByTag({
      owner: OWNER(), repo: REPO(), tag,
    });
    return { id: data.id, upload_url: data.upload_url, tag_name: data.tag_name };
  } catch {
    // Create the release
    const { data } = await octokit.rest.repos.createRelease({
      owner:      OWNER(),
      repo:       REPO(),
      tag_name:   tag,
      name:       'FileFlow Uploads',
      body:       'Files uploaded via FileFlow.',
      draft:      false,
      prerelease: true,
    });
    return { id: data.id, upload_url: data.upload_url, tag_name: data.tag_name };
  }
}

// ── Upload asset to GitHub Release ────────────────────────────────────────────
export async function uploadToGitHubRelease(
  fileName:    string,
  contentType: string,
  data:        Buffer | Uint8Array,
): Promise<{ downloadUrl: string; assetId: number }> {
  const octokit = getOctokit();
  const release = await ensureUploadRelease(octokit);

  // Remove duplicate asset with same name if exists
  try {
    const { data: assets } = await octokit.rest.repos.listReleaseAssets({
      owner: OWNER(), repo: REPO(), release_id: release.id,
    });
    const dup = assets.find((a) => a.name === fileName);
    if (dup) {
      await octokit.rest.repos.deleteReleaseAsset({
        owner: OWNER(), repo: REPO(), asset_id: dup.id,
      });
    }
  } catch { /* ignore */ }

  const { data: asset } = await octokit.rest.repos.uploadReleaseAsset({
    owner:       OWNER(),
    repo:        REPO(),
    release_id:  release.id,
    name:        fileName,
    data:        data as unknown as string, // octokit types
    headers: {
      'content-type':   contentType,
      'content-length': data.length,
    },
  });

  return {
    downloadUrl: asset.browser_download_url,
    assetId:     asset.id,
  };
}

// ── List uploaded assets ───────────────────────────────────────────────────────
export async function listGitHubAssets(): Promise<
  { id: number; name: string; size: number; downloadUrl: string; createdAt: string }[]
> {
  const octokit = getOctokit();
  try {
    const release = await ensureUploadRelease(octokit);
    const { data } = await octokit.rest.repos.listReleaseAssets({
      owner: OWNER(), repo: REPO(), release_id: release.id, per_page: 100,
    });
    return data.map((a) => ({
      id:          a.id,
      name:        a.name,
      size:        a.size,
      downloadUrl: a.browser_download_url,
      createdAt:   a.created_at,
    }));
  } catch {
    return [];
  }
}
