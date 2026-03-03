import * as path from 'path';
import * as vscode from 'vscode';
import { detectLanguageFromFile, getWorkspaceRoot, isInsidePath } from './utils';

export type DockOpenMode = 'newWindow' | 'currentWindow' | 'ask';

export interface DockProject {
  name: string;
  path: string;
  tags: string[];
  languages: string[];
  status: 'active';
  createdAt: string;
}

interface DockIndex {
  projects: DockProject[];
}

export class ProjectManager {
  private readonly indexRelativePath = '.dock/index.json';

  public async getProjects(): Promise<DockProject[]> {
    const index = await this.readIndex();
    return index.projects;
  }

  public async registerProject(resourceUri?: vscode.Uri): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      void vscode.window.showWarningMessage('Dock requires an open workspace folder.');
      return;
    }

    let selectedUri = resourceUri;
    if (!selectedUri) {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Register to Dock',
        defaultUri: root.uri
      });
      selectedUri = selected?.[0];
    }

    if (!selectedUri) {
      return;
    }

    const stat = await vscode.workspace.fs.stat(selectedUri);
    const projectRootUri = stat.type === vscode.FileType.File
      ? vscode.Uri.file(path.dirname(selectedUri.fsPath))
      : selectedUri;

    const defaultName = path.basename(projectRootUri.fsPath);
    const customName = await vscode.window.showInputBox({
      prompt: 'Optional project name for Dock',
      value: defaultName,
      placeHolder: 'Leave as-is to use folder name'
    });

    if (customName === undefined) {
      return;
    }

    const name = customName.trim() || defaultName;
    const languages = await this.detectLanguagesForFolder(projectRootUri);

    const index = await this.readIndex();
    const existing = index.projects.find((project) => project.path === projectRootUri.fsPath);

    if (existing) {
      existing.name = name;
      existing.languages = Array.from(new Set([...existing.languages, ...languages])).sort();
      await this.writeIndex(index);
      void vscode.window.showInformationMessage(`Dock updated project: ${name}`);
      return;
    }

    index.projects.push({
      name,
      path: projectRootUri.fsPath,
      tags: [],
      languages,
      status: 'active',
      createdAt: new Date().toISOString()
    });

    index.projects.sort((a, b) => a.name.localeCompare(b.name));
    await this.writeIndex(index);
    void vscode.window.showInformationMessage(`Registered "${name}" in Dock.`);
  }

  public async createNewProject(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      void vscode.window.showWarningMessage('Dock requires an open workspace folder.');
      return;
    }

    const folderName = await vscode.window.showInputBox({
      prompt: 'Project Folder Name',
      placeHolder: 'my-new-project',
      validateInput: (value) => value.trim() ? undefined : 'Project Folder Name is required.'
    });

    if (!folderName) {
      return;
    }

    const location = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select location (defaults to workspace root)',
      defaultUri: root.uri
    });

    const baseUri = location?.[0] ?? root.uri;
    const newFolderUri = vscode.Uri.joinPath(baseUri, folderName.trim());

    try {
      await vscode.workspace.fs.createDirectory(newFolderUri);
      void vscode.window.showInformationMessage(`Created folder: ${newFolderUri.fsPath}`);
    } catch (error) {
      void vscode.window.showErrorMessage(`Failed to create project folder: ${String(error)}`);
    }
  }

  public async searchProjects(onSelect: (project: DockProject) => Promise<void>): Promise<void> {
    const projects = await this.getProjects();
    if (projects.length === 0) {
      void vscode.window.showInformationMessage('No projects are registered in Dock yet.');
      return;
    }

    const picked = await vscode.window.showQuickPick(projects.map((project) => ({
      label: project.name,
      description: project.languages.join(', ') || 'No languages detected',
      detail: `${project.path}${project.tags.length ? ` | tags: ${project.tags.join(', ')}` : ''}`,
      project
    })), {
      placeHolder: 'Search by project name, tags, languages, or path',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (picked) {
      await onSelect(picked.project);
    }
  }

  public async updateProjectMetadataForUri(uri: vscode.Uri): Promise<boolean> {
    const index = await this.readIndex();
    let changed = false;

    for (const project of index.projects) {
      if (!isInsidePath(uri.fsPath, project.path)) {
        continue;
      }

      const language = detectLanguageFromFile(uri);
      if (language && !project.languages.includes(language)) {
        project.languages.push(language);
        project.languages.sort();
        changed = true;
      }
    }

    if (changed) {
      await this.writeIndex(index);
    }

    return changed;
  }

  public async resolveOpenMode(): Promise<DockOpenMode | 'addToWorkspace'> {
    const configuration = vscode.workspace.getConfiguration('dock');
    const configured = configuration.get<DockOpenMode>('defaultOpenMode', 'ask');

    if (configured !== 'ask') {
      return configured;
    }

    const picked = await vscode.window.showQuickPick([
      { label: 'New Window', value: 'newWindow' as const },
      { label: 'Current Window', value: 'currentWindow' as const },
      { label: 'Add to Workspace', value: 'addToWorkspace' as const }
    ], {
      placeHolder: 'Open project in:'
    });

    return picked?.value ?? 'currentWindow';
  }

  private async detectLanguagesForFolder(folderUri: vscode.Uri): Promise<string[]> {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folderUri, '**/*'),
      new vscode.RelativePattern(folderUri, '**/{node_modules,.git,out,dist}/**'),
      2000
    );

    const languages = new Set<string>();
    for (const file of files) {
      const language = detectLanguageFromFile(file);
      if (language) {
        languages.add(language);
      }
    }

    return Array.from(languages).sort();
  }

  private async readIndex(): Promise<DockIndex> {
    const root = getWorkspaceRoot();
    if (!root) {
      return { projects: [] };
    }

    const indexUri = vscode.Uri.joinPath(root.uri, this.indexRelativePath);
    try {
      const bytes = await vscode.workspace.fs.readFile(indexUri);
      const content = Buffer.from(bytes).toString('utf8');
      const parsed = JSON.parse(content) as DockIndex;
      if (!parsed.projects) {
        return { projects: [] };
      }
      return parsed;
    } catch {
      return { projects: [] };
    }
  }

  private async writeIndex(index: DockIndex): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      return;
    }

    const dockDir = vscode.Uri.joinPath(root.uri, '.dock');
    await vscode.workspace.fs.createDirectory(dockDir);
    const indexUri = vscode.Uri.joinPath(root.uri, this.indexRelativePath);
    const data = Buffer.from(JSON.stringify(index, null, 2), 'utf8');
    await vscode.workspace.fs.writeFile(indexUri, data);
  }
}
