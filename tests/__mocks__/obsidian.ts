/**
 * Comprehensive Obsidian API mocks for TaskNotes plugin testing
 * This mock provides a complete simulation of the Obsidian environment
 */

// Minimal Platform mock for mobile/desktop branching in settings
export const Platform = {
  isMobile: false,
  isDesktop: true,
};

import { EventEmitter } from 'events';

// Mock file system data structure
interface MockFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  content: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
  parent?: MockFolder;
}

interface MockFolder {
  path: string;
  name: string;
  children: Map<string, MockFile | MockFolder>;
  parent?: MockFolder;
}

// Global mock file system state
class MockVaultFileSystem {
  private files = new Map<string, MockFile>();
  private folders = new Map<string, MockFolder>();
  private emitter = new EventEmitter();

  constructor() {
    // Initialize with root folder
    this.folders.set('', {
      path: '',
      name: '',
      children: new Map(),
    });
  }

  // File operations
  create(path: string, content: string): MockFile {
    const normalizedPath = this.normalizePath(path);

    if (this.files.has(normalizedPath)) {
      throw new Error(`File already exists: ${normalizedPath}`);
    }

    this.ensureFolderExists(this.getParentPath(normalizedPath));

    const file: MockFile = {
      path: normalizedPath,
      name: this.getFileName(normalizedPath),
      basename: this.getBaseName(normalizedPath),
      extension: this.getExtension(normalizedPath),
      content,
      stat: {
        ctime: Date.now(),
        mtime: Date.now(),
        size: content.length,
      },
    };

    this.files.set(normalizedPath, file);
    this.emitter.emit('create', file);
    return file;
  }

  modify(file: MockFile, content: string): void {
    file.content = content;
    file.stat.mtime = Date.now();
    file.stat.size = content.length;
    this.emitter.emit('modify', file);
  }

  delete(path: string): void {
    const normalizedPath = this.normalizePath(path);
    const file = this.files.get(normalizedPath);
    if (file) {
      this.files.delete(normalizedPath);
      this.emitter.emit('delete', file);
    }
  }

  rename(oldPath: string, newPath: string): void {
    const oldNormalized = this.normalizePath(oldPath);
    const newNormalized = this.normalizePath(newPath);

    const file = this.files.get(oldNormalized);
    if (file) {
      this.files.delete(oldNormalized);
      file.path = newNormalized;
      file.name = this.getFileName(newNormalized);
      file.basename = this.getBaseName(newNormalized);
      this.files.set(newNormalized, file);
      this.emitter.emit('rename', file, oldNormalized);
    }
  }

  exists(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return this.files.has(normalizedPath) || this.folders.has(normalizedPath);
  }

  read(path: string): string {
    const normalizedPath = this.normalizePath(path);
    const file = this.files.get(normalizedPath);
    if (!file) {
      throw new Error(`File not found: ${normalizedPath}`);
    }
    return file.content;
  }

  getFiles(): MockFile[] {
    return Array.from(this.files.values());
  }

  getFile(path: string): MockFile | undefined {
    return this.files.get(this.normalizePath(path));
  }

  // Folder operations
  ensureFolderExists(path: string): void {
    if (!path) return;

    const normalizedPath = this.normalizePath(path);
    if (this.folders.has(normalizedPath)) return;

    const parentPath = this.getParentPath(normalizedPath);
    if (parentPath) {
      this.ensureFolderExists(parentPath);
    }

    const folder: MockFolder = {
      path: normalizedPath,
      name: this.getFileName(normalizedPath),
      children: new Map(),
    };

    this.folders.set(normalizedPath, folder);
  }

  // Path utilities
  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
  }

  private getParentPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash > 0 ? path.substring(0, lastSlash) : '';
  }

  private getFileName(path: string): string {
    return path.split('/').pop() || '';
  }

  private getBaseName(path: string): string {
    const fileName = this.getFileName(path);
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  }

  private getExtension(path: string): string {
    const fileName = this.getFileName(path);
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(lastDot + 1) : '';
  }

  // Event management
  on(event: string, callback: (...args: any[]) => void): void {
    this.emitter.on(event, callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    this.emitter.off(event, callback);
  }

  // Reset for testing
  reset(): void {
    this.files.clear();
    this.folders.clear();
    this.emitter.removeAllListeners();
    // Re-initialize root folder
    this.folders.set('', {
      path: '',
      name: '',
      children: new Map(),
    });
  }
}

// Global mock file system instance
const mockFileSystem = new MockVaultFileSystem();

// TFile mock class
export class TFile {
  public path: string;
  public vault: any = null;
  public parent: any = null;

  constructor(path?: string) {
    this.path = path || '';
  }

  get name(): string {
    return this.path.split('/').pop() || '';
  }

  get basename(): string {
    const name = this.name;
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(0, lastDot) : name;
  }

  get extension(): string {
    const name = this.name;
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(lastDot + 1) : '';
  }

  private _stat: any = null;

  get stat() {
    if (this._stat) {
      return this._stat;
    }
    const file = mockFileSystem.getFile(this.path);
    return file?.stat || {
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0,
    };
  }

  set stat(value: any) {
    this._stat = value;
  }
}

// TAbstractFile mock base class
export class TAbstractFile {
  constructor(public path: string) {}

  get name(): string {
    return this.path.split('/').pop() || '';
  }
}

// TFolder mock class
export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

// Vault mock class
export class Vault {
  private emitter = new EventEmitter();

  async create(path: string, content: string): Promise<TFile> {
    const file = mockFileSystem.create(path, content);
    const tFile = new TFile(file.path);
    this.emitter.emit('create', tFile);
    return tFile;
  }

  async modify(file: TFile, content: string): Promise<void> {
    const mockFile = mockFileSystem.getFile(file.path);
    if (mockFile) {
      mockFileSystem.modify(mockFile, content);
      this.emitter.emit('modify', file);
    }
  }

  async delete(file: TFile): Promise<void> {
    mockFileSystem.delete(file.path);
    this.emitter.emit('delete', file);
  }

  async rename(file: TFile, newPath: string): Promise<void> {
    const oldPath = file.path;
    mockFileSystem.rename(oldPath, newPath);
    file.path = newPath;
    this.emitter.emit('rename', file, oldPath);
  }

  async read(file: TFile): Promise<string> {
    return mockFileSystem.read(file.path);
  }

  async createFolder(path: string): Promise<TFolder> {
    mockFileSystem.ensureFolderExists(path);
    return new TFolder(path);
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    const normalizedPath = mockFileSystem['normalizePath'](path);
    if (mockFileSystem.exists(normalizedPath)) {
      return new TFile(normalizedPath);
    }
    return null;
  }

  getFiles(): TFile[] {
    return mockFileSystem.getFiles().map(file => new TFile(file.path));
  }

  getMarkdownFiles(): TFile[] {
    return mockFileSystem.getFiles()
      .filter(file => file.extension === 'md')
      .map(file => new TFile(file.path));
  }

  adapter = {
    exists: (path: string) => mockFileSystem.exists(path),
    mkdir: jest.fn().mockResolvedValue(undefined),
  };

  // Event management
  on(event: 'create' | 'modify' | 'delete' | 'rename', callback: (...args: any[]) => void): void {
    this.emitter.on(event, callback);
  }

  off(event: 'create' | 'modify' | 'delete' | 'rename', callback: (...args: any[]) => void): void {
    this.emitter.off(event, callback);
  }

  trigger(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }
}

// MetadataCache mock class
export class MetadataCache {
  private cache = new Map<string, any>();
  private emitter = new EventEmitter();

  getFileCache(file: TFile): any {
    return this.cache.get(file.path) || null;
  }

  getCache(path: string): any {
    return this.cache.get(path) || null;
  }

  setCache(path: string, metadata: any): void {
    this.cache.set(path, metadata);
    const file = new TFile(path);
    this.emitter.emit('changed', file, '', metadata);
  }

  deleteCache(path: string): void {
    this.cache.delete(path);
  }

  fileToLinktext(file: TFile, sourcePath: string, omitMdExtension: boolean = true): string {
    // Simple implementation: return basename without extension if omitMdExtension is true
    if (omitMdExtension && file.extension === 'md') {
      return file.basename;
    }
    return file.name;
  }

  // Event management
  on(event: 'changed' | 'resolve' | 'resolved', callback: (...args: any[]) => void): void {
    this.emitter.on(event, callback);
  }

  off(event: 'changed' | 'resolve' | 'resolved', callback: (...args: any[]) => void): void {
    this.emitter.off(event, callback);
  }

  trigger(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }
}

// FileManager mock class
export class FileManager {
  generateMarkdownLink(file: TFile, sourcePath?: string, subpath?: string, alias?: string): string {
    // Simulate Obsidian's behavior of respecting user settings
    // For testing, we'll generate markdown link format when this is called
    const fileName = file.basename;
    const displayText = alias || fileName;
    const path = file.path;
    let link = `[${displayText}](${path})`;
    if (subpath) {
      link = `[${displayText}](${path}${subpath})`;
    }
    return link;
  }

  async processFrontMatter(file: TFile, fn: (frontmatter: any) => void): Promise<void> {
    // Mock implementation
    const content = mockFileSystem.read(file.path);
    const frontmatter = this.parseFrontmatter(content);
    fn(frontmatter);
  }

  private parseFrontmatter(content: string): any {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      try {
        return require('yaml').parse(match[1]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

// Workspace mock class
export class Workspace {
  private emitter = new EventEmitter();
  private activeView: any = null;
  private views = new Map<string, any>();

  getActiveView(): any {
    return this.activeView;
  }

  setActiveView(view: any): void {
    this.activeView = view;
    this.emitter.emit('active-leaf-change');
  }

  getViewsOfType(type: string): any[] {
    return Array.from(this.views.values()).filter(view => view.getViewType() === type);
  }

  detachLeavesOfType(type: string): void {
    // Mock implementation
  }

  getLeavesOfType = jest.fn((type: string): any[] => {
    return this.getViewsOfType(type);
  });

  getLeaf(newLeaf: boolean = true): any {
    return {
      open: jest.fn().mockResolvedValue(undefined),
      openFile: jest.fn().mockResolvedValue(undefined)
    };
  }

  // Event management
  on(event: string, callback: (...args: any[]) => void): void {
    this.emitter.on(event, callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    this.emitter.off(event, callback);
  }

  trigger(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }
}

// App mock class
export class App {
  vault = new Vault();
  metadataCache = new MetadataCache();
  fileManager = new FileManager();
  workspace = new Workspace();

  // Required Obsidian App properties
  keymap = new Keymap();
  scope = new Scope();

  lastEvent: any = null;

  loadLocalStorage = jest.fn((key: string) => {
    try {
      return JSON.parse(localStorage.getItem(`obsidian-app-${key}`) || 'null');
    } catch {
      return null;
    }
  });

  saveLocalStorage = jest.fn((key: string, data: unknown | null) => {
    if (data === null) {
      localStorage.removeItem(`obsidian-app-${key}`);
    } else {
      localStorage.setItem(`obsidian-app-${key}`, JSON.stringify(data));
    }
  });

  constructor() {
    // Set up cross-references
    mockFileSystem.on('create', (file: MockFile) => {
      this.metadataCache.setCache(file.path, this.parseFileMetadata(file.content));
    });

    mockFileSystem.on('modify', (file: MockFile) => {
      this.metadataCache.setCache(file.path, this.parseFileMetadata(file.content));
    });

    mockFileSystem.on('delete', (file: MockFile) => {
      this.metadataCache.deleteCache(file.path);
    });
  }

  private parseFileMetadata(content: string): any {
    // Basic frontmatter parsing for metadata cache
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      try {
        const frontmatter = require('yaml').parse(match[1]);
        return {
          frontmatter,
          tags: frontmatter.tags || [],
        };
      } catch {
        return {};
      }
    }
    return {};
  }
}

// Plugin mock class
export class Plugin {
  app: App;
  manifest: any;

  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  async onload(): Promise<void> {}
  onunload(): void {}

  addCommand(command: any): void {}
  addRibbonIcon(icon: string, title: string, callback: () => void): void {}
  addSettingTab(tab: any): void {}

  loadData(): Promise<any> {
    return Promise.resolve({});
  }

  saveData(data: any): Promise<void> {
    return Promise.resolve();
  }
}

// Component mock class
export class Component {
  private children: Component[] = [];

  addChild<T extends Component>(component: T): T {
    this.children.push(component);
    return component;
  }

  removeChild<T extends Component>(component: T): T {
    const index = this.children.indexOf(component);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
    return component;
  }

  onload(): void {}
  onunload(): void {}
}

// Modal mock class
export class Modal extends Component {
  app: App;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  modalEl: HTMLElement;
  containerEl: HTMLElement;

  constructor(app: App) {
    super();
    this.app = app;
    this.titleEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.modalEl = document.createElement('div');
    this.containerEl = this.contentEl; // For compatibility with older APIs

    // Add Obsidian DOM methods to contentEl
    this.contentEl.addClass = function(...classes: string[]) {
      this.classList.add(...classes);
      return this;
    };
    this.contentEl.removeClass = function(...classes: string[]) {
      this.classList.remove(...classes);
      return this;
    };
    this.contentEl.createEl = function<T extends keyof HTMLElementTagNameMap>(tag: T, attrs?: any): HTMLElementTagNameMap[T] {
      const el = document.createElement(tag);
      if (attrs) {
        if (attrs.cls) {
          if (Array.isArray(attrs.cls)) {
            el.classList.add(...attrs.cls);
          } else {
            el.classList.add(attrs.cls);
          }
        }
        if (attrs.text) {
          el.textContent = attrs.text;
        }
        if (attrs.attr) {
          Object.entries(attrs.attr).forEach(([key, value]) => {
            el.setAttribute(key, String(value));
          });
        }
        if (attrs.href) {
          (el as any).href = attrs.href;
        }
        if (attrs.type) {
          (el as any).type = attrs.type;
        }
        if (attrs.value) {
          (el as any).value = attrs.value;
        }
      }
      this.appendChild(el);

      // Add the same DOM methods to the created element
      el.addClass = this.addClass;
      el.removeClass = this.removeClass;
      el.createEl = this.createEl;
      el.createDiv = this.createDiv;
      el.empty = this.empty;
      (el as any).appendText = function(text: string) {
        this.textContent = (this.textContent || '') + text;
        return this;
      };

      return el;
    };
    this.contentEl.createDiv = function(attrs?: any): HTMLDivElement {
      return this.createEl('div', attrs);
    };
    this.contentEl.empty = function() {
      this.innerHTML = '';
      return this;
    };
    this.contentEl.appendText = function(text: string) {
      this.textContent = (this.textContent || '') + text;
      return this;
    };

    // Copy methods to containerEl as well
    this.containerEl.addClass = this.contentEl.addClass;
    this.containerEl.removeClass = this.contentEl.removeClass;
    this.containerEl.createEl = this.contentEl.createEl;
    this.containerEl.createDiv = this.contentEl.createDiv;
    this.containerEl.empty = this.contentEl.empty;
    this.containerEl.appendText = this.contentEl.appendText;
  }

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }

  onOpen(): void {}
  onClose(): void {}
}

// SuggestModal mock class
export abstract class SuggestModal<T> extends Modal {
  inputEl: HTMLInputElement;
  resultContainerEl: HTMLElement;
  scope: Scope;

  constructor(app: App) {
    super(app);
    this.inputEl = document.createElement('input');
    this.resultContainerEl = document.createElement('div');
    this.scope = new Scope();
  }

  abstract getSuggestions(query: string): T[] | Promise<T[]>;
  abstract renderSuggestion(value: T, el: HTMLElement): void;
  abstract onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;

  // Mock methods
  setPlaceholder(placeholder: string): void {
    this.inputEl.placeholder = placeholder;
  }
  setInstructions(instructions: Array<{command: string, purpose: string}>): void {}

  onOpen(): void {}
  onClose(): void {}
}

// FuzzySuggestModal mock class
export abstract class FuzzySuggestModal<T> extends Modal {
  inputEl: HTMLInputElement;
  resultContainerEl: HTMLElement;
  scope: Scope;

  constructor(app: App) {
    super(app);
    this.inputEl = document.createElement('input');
    this.resultContainerEl = document.createElement('div');
    this.scope = new Scope();
  }

  abstract getItems(): T[];
  abstract getItemText(item: T): string;
  abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;

  // Mock methods for fuzzy search functionality
  setPlaceholder(placeholder: string): void {
    this.inputEl.placeholder = placeholder;
  }
  setInstructions(instructions: Array<{command: string, purpose: string}>): void {}
}

// AbstractInputSuggest mock class
export abstract class AbstractInputSuggest<T> {
  constructor(app: App, inputEl: HTMLInputElement) {
    // Mock constructor
  }

  abstract getSuggestions(query: string): T[];
  abstract renderSuggestion(suggestion: T, el: HTMLElement): void;
  abstract selectSuggestion(suggestion: T, evt: MouseEvent | KeyboardEvent): void;

  // Mock methods
  open(): void {}
  close(): void {}
}

// ItemView mock class
export class ItemView extends Component {
  app: App;
  containerEl: HTMLElement;

  constructor(leaf: any) {
    super();
    this.containerEl = document.createElement('div');
  }

  getViewType(): string {
    return 'mock-view';
  }

  getDisplayText(): string {
    return 'Mock View';
  }

  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}


// --- UI Components used by FilterBar ---


// Setting mock class
export class Setting {
  containerEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;
  settingEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.settingEl = document.createElement('div');
    this.nameEl = document.createElement('div');
    this.descEl = document.createElement('div');
    this.controlEl = document.createElement('div');
    // Append structure similar to Obsidian: name, controls, description inside settingEl
    this.settingEl.appendChild(this.nameEl);
    this.settingEl.appendChild(this.controlEl);
    this.settingEl.appendChild(this.descEl);
    this.containerEl.appendChild(this.settingEl);
  }

  setName(name: string): Setting {
    this.nameEl.textContent = name;
    return this;
  }

  setDesc(desc: string): Setting {
    this.descEl.textContent = desc;
    return this;
  }

  setHeading(): Setting {
    if (this.settingEl.addClass) {
      this.settingEl.addClass('setting-item-heading');
    } else {
      this.settingEl.classList.add('setting-item-heading');
    }
    return this;
  }

  addText(callback: (text: any) => void): Setting {
    const mockText = {
      inputEl: document.createElement('input'),
      setPlaceholder: (placeholder: string) => mockText,
      setValue: (value: string) => mockText,
      onChange: (callback: (value: string) => void) => mockText,
      setDisabled: (disabled: boolean) => mockText,
    };
    callback(mockText);
    return this;
  }

  addToggle(callback: (toggle: any) => void): Setting {
    const mockToggle = {
      toggleEl: document.createElement('div'),
      setValue: (value: boolean) => mockToggle,
      onChange: (callback: (value: boolean) => void) => mockToggle,
    };
    callback(mockToggle);
    return this;
  }

  addDropdown(callback: (dropdown: any) => void): Setting {
    const mockDropdown = {
      selectEl: document.createElement('select'),
      addOptions: (options: Record<string, string>) => mockDropdown,
      addOption: (key: string, label: string) => mockDropdown,
      setValue: (value: string) => mockDropdown,
      onChange: (callback: (value: string) => void) => mockDropdown,
      setDisabled: (disabled: boolean) => mockDropdown,
    };
    callback(mockDropdown);
    return this;
  }

  addButton(callback: (button: any) => void): Setting {
    const mockButton = {
      buttonEl: Object.assign(document.createElement('button'), {
        addClasses: function(classes: string[]) { 
          classes.forEach(cls => this.classList.add(cls)); 
        }
      }),
      setButtonText: (text: string) => { mockButton.buttonEl.textContent = text; return mockButton; },
      setTooltip: (text: string) => { mockButton.buttonEl.title = text; return mockButton; },
      setCta: () => mockButton,
      setWarning: () => mockButton,
      onClick: (cb: () => void) => { mockButton.buttonEl.addEventListener('click', cb); return mockButton; },
    };
    // Append to controls so text is visible in DOM for tests
    this.controlEl.appendChild(mockButton.buttonEl);
    callback(mockButton);
    return this;
  }
}

// PluginSettingTab mock class
export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
  hide(): void {}
}

// Utility functions
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
}

export function stringifyYaml(obj: any): string {
  return require('yaml').stringify(obj);
}

export function parseYaml(text: string): any {
  return require('yaml').parse(text);
}

// Minimal UI component mocks used by our UI tests
export class ButtonComponent {
  buttonEl: HTMLButtonElement;
  constructor(container: HTMLElement) {
    this.buttonEl = document.createElement('button');
    container.appendChild(this.buttonEl);
  }
  setIcon(icon: string) { this.buttonEl.setAttribute('data-icon', icon); return this; }
  setTooltip(tip: string) { this.buttonEl.setAttribute('data-tooltip', tip); return this; }
  setClass(cls: string) { this.buttonEl.classList.add(cls); return this; }
  setButtonText(text: string) { this.buttonEl.textContent = text; return this; }
  setCta() { return this; }
  onClick(cb: () => void) { this.buttonEl.addEventListener('click', cb); return this; }
}

export class TextComponent {
  inputEl: HTMLInputElement;
  constructor(container: HTMLElement) {
    this.inputEl = document.createElement('input');
    container.appendChild(this.inputEl);
  }
  setPlaceholder(text: string) { this.inputEl.placeholder = text; return this; }
  setValue(val: string) { this.inputEl.value = val ?? ''; return this; }
  getValue(): string { return this.inputEl.value; }
  onChange(cb: (value: string) => void) { this.inputEl.addEventListener('input', () => cb(this.inputEl.value)); return this; }
}

export class DropdownComponent {
  selectEl: HTMLSelectElement;
  constructor(container: HTMLElement) {
    this.selectEl = document.createElement('select');
    container.appendChild(this.selectEl);
  }
  addOption(value: string, label: string) { const opt = document.createElement('option'); opt.value = value; opt.textContent = label; this.selectEl.appendChild(opt); return this; }
  addOptions(options: Record<string, string>) { Object.entries(options).forEach(([v, l]) => this.addOption(v, l)); return this; }
  setValue(value: string) { this.selectEl.value = value; return this; }
  onChange(cb: (value: any) => void) { this.selectEl.addEventListener('change', () => cb(this.selectEl.value)); return this; }
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 0): T {
  let timer: any;
  const wrapped = ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  }) as any as T;
  return wrapped;
}


export const Notice = jest.fn().mockImplementation((message: string, timeout?: number) => {
  // Mock Notice for testing - just track that it was called
  return {};
});

// Menu mock class
export const Menu = jest.fn().mockImplementation(() => ({
  items: [],
  addItem: jest.fn().mockImplementation(function(this: any, callback: (item: any) => void) {
    const mockItem = {
      setTitle: jest.fn().mockReturnThis(),
      setIcon: jest.fn().mockReturnThis(),
      onClick: jest.fn().mockReturnThis(),
      setSection: jest.fn().mockReturnThis(),
    };
    callback(mockItem);
    this.items.push(mockItem);
  }),
  addSeparator: jest.fn().mockImplementation(function(this: any) {
    this.items.push({ type: 'separator' });
  }),
  showAtMouseEvent: jest.fn(),
  showAtPosition: jest.fn(),
}));

// Mock parseFrontMatterAliases function
export function parseFrontMatterAliases(frontmatter: any): string[] | null {
  if (!frontmatter) return null;
  const aliases = frontmatter.aliases || frontmatter.alias;
  if (!aliases) return null;
  if (Array.isArray(aliases)) return aliases;
  if (typeof aliases === 'string') return [aliases];
  return null;
}

// Mock parseLinktext function based on official Obsidian API
export function parseLinktext(linktext: string): { path: string; subpath: string } {
  // Handle subpath syntax: [[path#subpath]]
  const hashIndex = linktext.indexOf('#');
  if (hashIndex !== -1) {
    return {
      path: linktext.slice(0, hashIndex).trim(),
      subpath: linktext.slice(hashIndex + 1).trim()
    };
  }

  // Simple path: [[path]]
  return {
    path: linktext.trim(),
    subpath: ''
  };
}

// Icon utilities
export function setIcon(element: HTMLElement, iconName: string): void {
  // Mock implementation - just add a class or data attribute
  element.setAttribute('data-icon', iconName);
  element.classList.add('has-icon');
}

// Tooltip utilities
export function setTooltip(element: HTMLElement, tooltip: string, options?: { placement?: string }): void {
  // Mock implementation - just add tooltip attributes
  element.setAttribute('data-tooltip', tooltip);
  if (options?.placement) {
    element.setAttribute('data-tooltip-placement', options.placement);
  }
  element.classList.add('has-tooltip');
}

// API version check utilities (added in Obsidian 1.11.0)
export function requireApiVersion(version: string): boolean {
  // Mock implementation - returns true for testing purposes
  // This allows testing code that uses SettingGroup
  return true;
}

// SettingGroup mock class (added in Obsidian 1.11.0)
export class SettingGroup {
  private containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  setHeading(text: string | DocumentFragment): this {
    const heading = document.createElement('div');
    heading.classList.add('setting-item-heading');
    if (typeof text === 'string') {
      heading.textContent = text;
    } else {
      heading.appendChild(text);
    }
    this.containerEl.appendChild(heading);
    return this;
  }

  addClass(cls: string): this {
    this.containerEl.classList.add(cls);
    return this;
  }

  addSetting(cb: (setting: Setting) => void): this {
    const setting = new Setting(this.containerEl);
    cb(setting);
    return this;
  }
}

// Keymap mock class
export class Keymap {
  pushScope = jest.fn();
  popScope = jest.fn();
  bindKey = jest.fn();
  unbindKey = jest.fn();
  setDefaultBindings = jest.fn();
  getBinding = jest.fn();
  isModifierEvent = jest.fn(() => false);
}

// Scope mock class
export class Scope {
  keys: any[] = [];

  constructor(parent?: Scope) {
    // Mock constructor
  }

  register = jest.fn();
  unregister = jest.fn();
}

// Events system
export class Events {
  private emitter = new EventEmitter();

  on(event: string, callback: (...args: any[]) => void): void {
    this.emitter.on(event, callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    this.emitter.off(event, callback);
  }

  trigger(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }
}

// Mock reset utility for tests
export const MockObsidian = {
  reset: () => {
    mockFileSystem.reset();
  },

  getFileSystem: () => mockFileSystem,

  // Helper to create test files
  createTestFile: (path: string, content: string) => mockFileSystem.create(path, content),
  getTestFiles: () => mockFileSystem.getFiles(),
  createMockApp: () => new App(),

  // Export class constructors for testing
  Menu,
  Notice,
  setIcon,
  setTooltip,
};

// Simple debounce mock: return the original function for test determinism
export function debounce<T extends (...args: any[]) => any>(fn: T, _wait?: number): T {
  return fn;
}

// Helper to create test files
export function createTestFile(path: string, content: string) {
  return mockFileSystem.create(path, content);
}

// Helper to get test files
export function getTestFiles() {
  return mockFileSystem.getFiles();
}

// Helper to create mock app instance
export function createMockApp() {
  return new App();
}

// Default export for compatibility
export default {
  TFile,
  TAbstractFile,
  TFolder,
  Vault,
  MetadataCache,
  FileManager,
  Workspace,
  App,
  Plugin,
  Component,
  Modal,
  SuggestModal,
  FuzzySuggestModal,
  AbstractInputSuggest,
  ItemView,
  Setting,
  PluginSettingTab,
  Menu,
  Keymap,
  Scope,
  normalizePath,
  stringifyYaml,
  parseYaml,
  Notice,
  Events,
  setIcon,
  setTooltip,
  parseFrontMatterAliases,
  parseLinktext,
  MockObsidian,
  debounce,
  ButtonComponent,
  TextComponent,
  DropdownComponent,
  createTestFile,
  getTestFiles,
  createMockApp,
};