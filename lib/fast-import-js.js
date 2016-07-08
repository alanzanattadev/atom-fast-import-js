'use babel';

import { CompositeDisposable } from 'atom';
import subAtom from 'sub-atom';
import path from 'path';
import camelCase from 'camelcase'

export default {

  subscriptions: null,

  getLineToAdd(currentBufferPath, filePath, importSpecifier) {
    let importPath = path.relative(currentBufferPath, filePath).slice(1);
    importPath = path.normalize(importPath);
    if (importPath[0] != '.')
      importPath = './' + importPath;
    importPath = importPath.slice(0, importPath.length - path.extname(importPath).length);
    importPath =  importPath.slice(0, importPath.length - (importPath.endsWith('index') ? 6 : 0));
    return `import ${importSpecifier} from "${importPath}";\n`;
  },

  getSpecifierOfNewImport(selectedText, filePath) {
    if (selectedText)
      return selectedText;
    let isIndex = path.basename(filePath).startsWith('index.');
    let moduleName;
    if (isIndex)
      moduleName = path.dirname(filePath).split('/').pop();
    else
      moduleName = path.basename(filePath).split('.')[0];
    return camelCase(moduleName);
  },

  getIndexOfNewImport(buffer) {
    let index = buffer.indexOf('import');
    if (index == -1)
      index = buffer.indexOf('require');
    if (index == -1)
      index = 0;
    return index;
  },

  addLineToBuffer(buffer, index, line) {
    return buffer.slice(0, index) + line + buffer.slice(index);
  },

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new subAtom();
    this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
      let editorView = atom.views.getView(editor);
      let lines = editorView.shadowRoot.querySelector('.lines');
      this.subscriptions.add(lines, 'drop', e => {
        let filePath = e.originalEvent.dataTransfer.getData('initialPath');
        if (filePath && editor.getPath()) {
          let buffer = editor.getText();
          let specifier = this.getSpecifierOfNewImport(editor.getSelectedText(), filePath);
          let index = this.getIndexOfNewImport(buffer);
          let lineToAdd = this.getLineToAdd(editor.getPath(), filePath, specifier);
          buffer = this.addLineToBuffer(buffer, index, lineToAdd);
          editor.setText(buffer);
        }
      });
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {
    return {};
  },
};
