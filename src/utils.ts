import * as path from 'path';
import * as vscode from 'vscode';

const languageByExtension: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.json': 'json',
  '.md': 'markdown',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.yml': 'yaml',
  '.yaml': 'yaml'
};

export const detectLanguageFromFile = (uri: vscode.Uri): string | undefined => {
  const ext = path.extname(uri.fsPath).toLowerCase();
  return languageByExtension[ext];
};

export const isInsidePath = (targetPath: string, rootPath: string): boolean => {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(rootPath);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
};

export const getWorkspaceRoot = (): vscode.WorkspaceFolder | undefined => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }
  return workspaceFolders[0];
};

export const getWorkspaceName = (): string => {
  return getWorkspaceRoot()?.name ?? 'No Workspace';
};
