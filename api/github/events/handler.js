import { Octokit } from '@octokit/rest';
import { minimatch } from 'minimatch';
import Parser from 'tree-sitter';
import Typescript from 'tree-sitter-typescript';

export const config = {
  runtime: 'edge',
};

const { GITHUB_TOKEN } = process.env;
const PARSERS = initParsers();

function initParsers() {
  const tsParser = new Parser();
  tsParser.setLanguage(Typescript.typescript);

  const tsxParser = new Parser();
  tsxParser.setLanguage(Typescript.tsx);

  return {
    ts: tsParser,
    tsx: tsxParser,
  };
}

/**
 * 
 * @param {Request} request 
 * @param {import('@vercel/edge').RequestContext} context 
 */
export default async function handler(request, context) {
  console.log(await request.text());
  return new Response(null, { status: 200 });
};

async function quantifyPr({ owner, repo, pull_number }, config) {
  config.labels.sort((a, b) => a.maxChanges - b.maxChanges);

  const REPO_INFO = {
    owner,
    repo,
  };

  const PR_INFO = {
    ...REPO_INFO,
    pull_number,
  };

  const github = new Octokit({
    auth: GITHUB_TOKEN,
  });

  const { data: pr } = await github.pulls.get(PR_INFO);
  const files = await getPrFiles(github, PR_INFO);

  const filteredFiles = files.filter((file) => !config.exclude.files.some(
    (excludePattern) => minimatch(file.filename, excludePattern)
  ));

  const statsPromises = filteredFiles.map(async (file) => {
    const oldFile = await getFile(github, {
      ...REPO_INFO,
      path: file.previous_filename ?? file.filename,
      ref: file.status === 'removed' ? file.contents_url.split('ref=').at(-1) : pr.base.sha,
    });

    const newFile = await getFile(github, {
      ...REPO_INFO,
      path: file.filename,
      ref: pr.head.sha,
    });

    return countFile(file.patch ?? "", oldFile, newFile);
  });

  const statsPerFile = await Promise.all(statsPromises);
  const { stats, changes, label } = countTotalCountInfo(statsPerFile, config);

  const configLabelNames = config.labels.map(label => label.name);
  const labelsToRemove = pr.labels.filter(
    (prLabel) => prLabel.name !== label.name && configLabelNames.includes(prLabel.name),
  );

  await Promise.all(labelsToRemove.map((label) => github.issues.removeLabel({
    ...REPO_INFO,
    issue_number: PR_INFO.pull_number,
    name: label.name,
  })));

  if (!pr.labels.find((prLabel) => prLabel.name === label.name)) {
    await github.issues.addLabels({
      ...REPO_INFO,
      issue_number: PR_INFO.pull_number,
      labels: [label.name],
    });

    // await github.issues.createComment({
    //   ...REPO_INFO,
    //   issue_number: pr.number,
    //   body: '## This pull request seems to have `' + changes + '` changes!\nGenerally speaking it is best to aim for `' + config.target + '` or less to keep pull requests easy and quick to review!\n\n### Detailed stats:\n```json\n' + JSON.stringify(stats, null, 2) + '\n```\n\n' + (changes <= config.target ? '![](https://media.tenor.com/TMCjhANSMhEAAAAC/bear-small-but-mighty.gif)\n' : '![](https://media.tenor.com/WxsVrj5SehYAAAAM/you-are-fat-face.gif)\n'),
    // });
  }
}

async function getPrFiles(github, { owner, repo, pull_number }) {
  const PAGE_SIZE = 100;

  const allFiles = [];
  let files = [];
  let page = 1;

  do {
    const res = await github.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page: PAGE_SIZE,
      page,
    });

    page++;
    files = res.data;
    allFiles.push(...files);
  }
  while (files.length === PAGE_SIZE);

  return allFiles;
}

async function getFile(github, { owner, repo, path, ref }) {
  try {
    const res = await github.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    return {
      filename: path,
      content: Buffer.from(res.data.content, 'base64').toString(),
      notFound: false,
    };
  }
  catch (err) {
    return {
      filename: path,
      content: "",
      notFound: true,
    };
  }
}

function countTotalCountInfo(statsPerFile, config) {
  const stats = statsPerFile.reduce((a, b) => ({
    additions: {
      default: a.additions.default + b.additions.default,
      blank: a.additions.blank + b.additions.blank,
      imports: a.additions.imports + b.additions.imports,
      comments: a.additions.comments + b.additions.comments,
    },
    deletions: {
      default: a.deletions.default + b.deletions.default,
      blank: a.deletions.blank + b.deletions.blank,
      imports: a.deletions.imports + b.deletions.imports,
      comments: a.deletions.comments + b.deletions.comments,
    }
  }));

  let changes = stats.additions.default + stats.deletions.default;
  if (!config?.exclude?.lines?.blank) changes += stats.additions.blank + stats.deletions.blank;
  if (!config?.exclude?.lines?.comments) changes += stats.additions.comments + stats.deletions.comments;
  if (!config?.exclude?.lines?.imports) changes += stats.additions.imports + stats.deletions.imports;

  const label = config.labels?.find(label => !label.maxChanges || label.maxChanges >= changes);

  return {
    stats,
    changes,
    label,
  };
}

function countFile(patchContent, oldFile, newFile) {
  const stats = {
    additions: {
      default: 0,
      blank: 0,
      imports: 0,
      comments: 0,
    },
    deletions: {
      default: 0,
      blank: 0,
      imports: 0,
      comments: 0,
    }
  };

  const oldLines = oldFile.content.split('\n');
  const newLines = newFile.content.split('\n');

  const oldFileExtension = oldFile.filename.split('.').at(-1);
  const newFileExtension = newFile.filename.split('.').at(-1);

  const oldTree = PARSERS[oldFileExtension]?.parse(oldFile.content);
  const newTree = PARSERS[newFileExtension]?.parse(newFile.content);

  const patch = patchContent.split('\n');

  let oldRow, newRow;

  for (const line of patch) {
    if (line.startsWith("@@")) {
      const matches = line.match(/(-|\+)?(\d+),\d+ (-|\+)?(\d+),\d+/);

      if (matches[1] === '+') {
        newRow = parseInt(matches[2]);
        oldRow = parseInt(matches[4]);
      }
      else {
        oldRow = parseInt(matches[2]);
        newRow = parseInt(matches[4]);
      }
    }
    else if (line.startsWith("-")) {
      if (oldFile.notFound) {
        stats.deletions.default++;
      }
      else {
        countLine(oldLines, oldTree, oldRow, stats.deletions);
      }

      oldRow++;
    }
    else if (line.startsWith("+")) {
      if (newFile.notFound) {
        stats.additions.default++;
      }
      else {
        countLine(newLines, newTree, newRow, stats.additions);
      }

      newRow++;
    }
    else {
      oldRow++;
      newRow++;
    }
  }

  return stats;
}

function countLine(lines, tree, row, stats) {
  if (lines[row - 1].match(/^\s*$/)) {
    stats.blank++;
    return;
  }

  if (!tree) {
    stats.default++;
    return;
  }

  let node = tree.rootNode.descendantForPosition({ row: row, column: 0 });
  let isComment = node.type.includes("comment");
  let isImport = node.type.includes("import");

  while (node.parent && !isComment && !isImport) {
    node = node.parent;
    isComment = node.type.includes("comment");
    isImport = node.type.includes("import");
  }

  if (isComment) {
    stats.comments++;
    return;
  }

  if (isImport) {
    stats.imports++;
    return;
  }

  stats.default++;
}
