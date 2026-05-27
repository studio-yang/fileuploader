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

const TRASH_PREFIX = '_TRASH_';

// ── List uploaded assets（過濾垃圾桶內容）─────────────────────────────────
export async function listGitHubAssets(opts?: { trashed?: boolean }): Promise<
  { id: number; name: string; size: number; downloadUrl: string; createdAt: string }[]
> {
  const octokit = getOctokit();
  const trashed = opts?.trashed ?? false;
  try {
    const release = await ensureUploadRelease(octokit);
    const { data } = await octokit.rest.repos.listReleaseAssets({
      owner: OWNER(), repo: REPO(), release_id: release.id, per_page: 100,
    });
    return data
      .filter((a) => trashed ? a.name.startsWith(TRASH_PREFIX) : !a.name.startsWith(TRASH_PREFIX))
      .map((a) => ({
        id:          a.id,
        name:        trashed ? a.name.replace(TRASH_PREFIX, '') : a.name,
        size:        a.size,
        downloadUrl: a.browser_download_url,
        createdAt:   a.created_at,
      }));
  } catch {
    return [];
  }
}

// ── 移到垃圾桶（asset 改名加 _TRASH_ 前綴）─────────────────────────────
export async function trashGitHubAsset(assetId: number): Promise<void> {
  const octokit = getOctokit();
  // 取得原 asset 名稱
  const { data: asset } = await octokit.rest.repos.getReleaseAsset({
    owner: OWNER(), repo: REPO(), asset_id: assetId,
  });
  if (asset.name.startsWith(TRASH_PREFIX)) return; // 已在垃圾桶
  await octokit.rest.repos.updateReleaseAsset({
    owner: OWNER(), repo: REPO(), asset_id: assetId,
    name: `${TRASH_PREFIX}${asset.name}`,
  });
}

// ── 從垃圾桶還原 ─────────────────────────────────────────────────────────
export async function restoreGitHubAsset(assetId: number): Promise<void> {
  const octokit = getOctokit();
  const { data: asset } = await octokit.rest.repos.getReleaseAsset({
    owner: OWNER(), repo: REPO(), asset_id: assetId,
  });
  if (!asset.name.startsWith(TRASH_PREFIX)) return;
  await octokit.rest.repos.updateReleaseAsset({
    owner: OWNER(), repo: REPO(), asset_id: assetId,
    name: asset.name.replace(TRASH_PREFIX, ''),
  });
}

// ── 永久刪除 ──────────────────────────────────────────────────────────────
export async function permanentDeleteGitHubAsset(assetId: number): Promise<void> {
  await getOctokit().rest.repos.deleteReleaseAsset({
    owner: OWNER(), repo: REPO(), asset_id: assetId,
  });
}
