'use babel';

import { CompositeDisposable, File, Directory } from 'atom';
import subAtom from 'sub-atom';
import path from 'path';
import camelCase from 'camelcase'
import { fromJS } from "immutable";

export default {

  config: {
    semicolons: {
      type: 'boolean',
      default: true,
      title: 'Adds semicolons'
    },
    quote: {
      type: 'string',
      default: "\"",
      title: 'Quote character around imported path',
      enum: [
        {value: '\'', description: 'Single quote'},
        {value: '\"', description: 'Double quote'},
        {value: '\`', description: 'Back quote'}
      ]
    }
  },

  subscriptions: null,

  getLineToAdd(currentBufferPath, filePath, importSpecifier, importPath) {
    let semicolons = atom.config.get('fast-import-js.semicolons') ? ';' : '';
    let quote = atom.config.get('fast-import-js.quote');
    return `import ${importSpecifier} from ${quote}${importPath}${quote}${semicolons}\n`;
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
    if (moduleName[0] == moduleName[0].toUpperCase()) {
      return moduleName[0] + camelCase(moduleName.slice(1));
    } else {
      return camelCase(moduleName);
    }
  },

  getPackageJsonPath(fileWhichRequires) {
      let parentFolders = [];
      let parentFolder = new File(fileWhichRequires).getParent();
      while (parentFolder.getBaseName() != "") {
        parentFolders.push(parentFolder);
        parentFolder = parentFolder.getParent();
      }
      let existsPromises = parentFolders.map((path) => new Promise((resolve, reject) => {
        path.getFile("package.json").exists().then((fileExists) => {
          resolve(fileExists);
        });
      }));
      return Promise.all(existsPromises).then((results) => {
        return parentFolders[results.indexOf(true)].getPath();
      });
  },

  getImportPath(requiredFilePath, fileWhichRequiresPath) {
    return this.getPackageJsonPath(fileWhichRequiresPath).then(packageConfigDirectoryPath => {
      let packageConfigFile = new File(path.join(packageConfigDirectoryPath, "package.json"));
      if (new Directory(packageConfigDirectoryPath).contains(requiredFilePath)) {
        console.log("file contained in the same module, using relative path");
        let importPath = path.relative(fileWhichRequiresPath, requiredFilePath).slice(1);
        importPath = path.normalize(importPath);
        if (importPath[0] != '.')
          importPath = './' + importPath;
        return importPath;
      } else {
        console.log("file in another module, reading package.json");
        return packageConfigFile.read(false).then(packageConfigAsString => {
          console.log(packageConfigAsString);
          let packageConfig = JSON.parse(packageConfigAsString);
          console.log(packageConfig);
          let entriesToModulesMapper = tuple => fromJS({moduleName: tuple[0], modulePath: tuple[1]});
          let dependencies = fromJS([])
                              .concat(fromJS(packageConfig).get('dependencies', fromJS({})).entrySeq().map(entriesToModulesMapper))
                              .concat(fromJS(packageConfig).get('devDependencies', fromJS({})).entrySeq().map(entriesToModulesMapper))
                              .concat(fromJS(packageConfig).get('peerDependencies', fromJS({})).entrySeq().map(entriesToModulesMapper))
                              .toJS();
          console.log("dependencies");
          console.log(dependencies);
          let relativeDependencies = dependencies.filter(dependency => dependency.modulePath.startsWith("file:"));
          console.log("relatives");
          console.log(relativeDependencies);
          let requiredDependencyOfFile = relativeDependencies.find(
            dependency => new Directory(path.resolve(packageConfigDirectoryPath, dependency.modulePath.slice(5)))
                                .contains(requiredFilePath)
          );
          console.log("dependency containing the file found");
          console.log(requiredDependencyOfFile, requiredFilePath, relativeDependencies);
          if (requiredDependencyOfFile) {
            return requiredDependencyOfFile.moduleName + '/' + path.relative(path.resolve(packageConfigDirectoryPath, requiredDependencyOfFile.modulePath.slice(5)), requiredFilePath);
          } else {
            return Promise.reject("not found");
          }
        });
      }
    }).catch(e => {
      return Promise.reject("not a module")
    }).then(importPath => {
      importPath = importPath.slice(0, importPath.length - path.extname(importPath).length);
      importPath =  importPath.slice(0, importPath.length - (importPath.endsWith('index') ? 6 : 0));
      return importPath;
    });
  },

  getIndexOfNewImport(buffer) {
    let lastIndexOfRegexp = (str, regexp) => {
      let match = str.match(regexp);
      return match ? (str.lastIndexOf(match[match.length - 1]) + match[match.length - 1].length) : -1;
    };
    let importRegexp = /\nimport\s.*\sfrom\s+[\'\"\`]\S*[\'\"\`]\ *\;?\n/g;
    let requireRegexp = /\n\w.*\=\s*require\s*\(\S*\)\ *\;?\n/g;
    let index = lastIndexOfRegexp(buffer, importRegexp);
    if (index == -1)
      index = lastIndexOfRegexp(buffer, requireRegexp);
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
          this.getImportPath(filePath, editor.getPath()).then(importPath => {
            let lineToAdd = this.getLineToAdd(editor.getPath(), filePath, specifier, importPath);
            let index = this.getIndexOfNewImport(buffer);
            buffer = this.addLineToBuffer(buffer, index, lineToAdd);
            editor.setText(buffer);
            atom.notifications.addSuccess(`Imported ${importPath} as ${specifier}`)
          }).catch(e => {
            atom.notifications.addWarning(`Cannot resolve import path : ${e}`);
          });
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
