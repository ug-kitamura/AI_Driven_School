import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
export { getProjectFolderId } from "@/lib/workspace-path-utils";

export function findTreeNode(
  nodes: WorkspaceTreeNode[],
  folderPath: string,
): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.path === folderPath) return node;
    const found = findTreeNode(node.children, folderPath);
    if (found) return found;
  }
  return null;
}

export function fileExistsInTree(
  nodes: WorkspaceTreeNode[],
  folderPath: string,
  fileName: string,
): boolean {
  const node = findTreeNode(nodes, folderPath);
  return node?.files.includes(fileName) ?? false;
}

export function folderExistsInTree(
  nodes: WorkspaceTreeNode[],
  folderPath: string,
): boolean {
  return findTreeNode(nodes, folderPath) !== null;
}

export function getAncestorFolderPaths(folderPath: string): string[] {
  if (!folderPath) return [];
  const segments = folderPath.split("/");
  const ancestors: string[] = [];
  for (let i = 1; i <= segments.length; i += 1) {
    ancestors.push(segments.slice(0, i).join("/"));
  }
  return ancestors;
}

export function collectProjectFolderPaths(
  nodes: WorkspaceTreeNode[],
): string[] {
  return nodes.map((node) => node.path);
}

export function collectAllFolderPaths(nodes: WorkspaceTreeNode[]): string[] {
  const paths: string[] = [];
  function walk(node: WorkspaceTreeNode) {
    paths.push(node.path);
    for (const child of node.children) {
      walk(child);
    }
  }
  for (const node of nodes) {
    walk(node);
  }
  return paths;
}

export function filterWorkspaceTree(
  nodes: WorkspaceTreeNode[],
  query: string,
): WorkspaceTreeNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;

  function filterNode(node: WorkspaceTreeNode): WorkspaceTreeNode | null {
    const folderMatch = node.name.toLowerCase().includes(normalized);
    const matchingFiles = node.files.filter((file) =>
      file.toLowerCase().includes(normalized),
    );
    const matchingChildren = node.children
      .map((child) => filterNode(child))
      .filter((child): child is WorkspaceTreeNode => child !== null);

    if (folderMatch) {
      return { ...node };
    }
    if (matchingFiles.length > 0 || matchingChildren.length > 0) {
      return {
        ...node,
        files: matchingFiles.length > 0 ? matchingFiles : node.files,
        children: matchingChildren,
      };
    }
    return null;
  }

  return nodes
    .map((node) => filterNode(node))
    .filter((node): node is WorkspaceTreeNode => node !== null);
}

export function getFolderBaseName(folderPath: string): string {
  const idx = folderPath.lastIndexOf("/");
  return idx >= 0 ? folderPath.slice(idx + 1) : folderPath;
}

export function buildRenamedFolderPath(
  folderPath: string,
  newName: string,
): string {
  const idx = folderPath.lastIndexOf("/");
  if (idx < 0) return newName;
  return `${folderPath.slice(0, idx)}/${newName}`;
}

export function remapFolderPath(
  folderPath: string,
  fromPath: string,
  toPath: string,
): string {
  if (folderPath === fromPath) return toPath;
  if (folderPath.startsWith(`${fromPath}/`)) {
    return `${toPath}${folderPath.slice(fromPath.length)}`;
  }
  return folderPath;
}
