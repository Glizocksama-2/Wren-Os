import { execFileSync, execSync } from "node:child_process";

const githubRepo = process.env.WREN_GITHUB_REPO ?? "Glizocksama-2/Wren-Os";
const githubOwner = process.env.WREN_GITHUB_OWNER ?? githubRepo.split("/")[0];
const githubLimit = process.env.WREN_GITHUB_LIMIT ?? "50";

const snapshot = {
  generatedAt: new Date().toISOString(),
  github: readGitHubSources(),
  vercel: readVercelProjects()
};

process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);

function readGitHubSources() {
  if (process.env.WREN_GITHUB_REPO) return readGitHubRepo(githubRepo);

  try {
    const output = run("gh", [
      "repo",
      "list",
      githubOwner,
      "--limit",
      githubLimit,
      "--json",
      "name,nameWithOwner,description,url,defaultBranchRef,pushedAt,repositoryTopics,primaryLanguage,isPrivate"
    ]);
    const repositories = JSON.parse(output);
    if (Array.isArray(repositories) && repositories.length) return repositories.map(mapGitHubRepository);
  } catch {
    return readGitHubRepo(githubRepo);
  }

  return readGitHubRepo(githubRepo);
}

function readGitHubRepo(repo) {
  try {
    const output = run("gh", [
      "repo",
      "view",
      repo,
      "--json",
      "name,nameWithOwner,description,url,defaultBranchRef,pushedAt,repositoryTopics,primaryLanguage,issues"
    ]);
    const data = JSON.parse(output);

    return [mapGitHubRepository(data)];
  } catch (error) {
    return [
      {
        name: repo,
        fullName: repo,
        description: `GitHub CLI snapshot failed: ${getErrorMessage(error)}`,
        url: `https://github.com/${repo}`,
        status: "snapshot_failed",
        openIssues: 0,
        tags: ["github"]
      }
    ];
  }
}

function mapGitHubRepository(data) {
  return {
    name: data.name,
    fullName: data.nameWithOwner,
    description: data.description ?? "",
    url: data.url,
    branch: data.defaultBranchRef?.name ?? null,
    openIssues: data.issues?.totalCount ?? 0,
    updatedAt: data.pushedAt ?? null,
    tags: (data.repositoryTopics ?? []).map((topic) => topic.name).filter(Boolean),
    language: data.primaryLanguage?.name ?? null,
    status: data.isPrivate ? "private" : "public"
  };
}

function readVercelProjects() {
  try {
    const output = stripAnsi(execSync("vercel project ls 2>&1", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .map(parseVercelProjectLine)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseVercelProjectLine(line) {
  if (
    !line ||
    line.startsWith("Vercel CLI") ||
    line.startsWith(">") ||
    line.startsWith("Fetching") ||
    line.startsWith("Project Name") ||
    line.startsWith("No projects")
  ) {
    return null;
  }

  const match = line.match(/^([A-Za-z0-9_.-]+)\s+(https?:\/\/\S+|-)\s+(.+?)\s+([0-9]+\.x|N\/A)$/);
  if (!match) return null;

  return {
    name: match[1],
    productionUrl: match[2] === "-" ? null : match[2],
    status: "linked",
    updatedAt: match[3],
    framework: null,
    tags: ["vercel"],
    deploymentCount: match[2] === "-" ? 0 : 1,
    nodeVersion: match[4]
  };
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return "unknown error";
}
