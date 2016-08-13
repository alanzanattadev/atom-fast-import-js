# fast-import-js

Import javascript modules faster than ever by drag and droping from tree-view to your editor pane.

![A screenshot of your package](https://raw.githubusercontent.com/alanzanattadev/atom-fast-import-js/master/record.gif)

## Use

Drag and drop a file from the tree-view to the editor pane.
If a variable name is selected, the specifier will be the variable name instead of the camelcased filename.

## Features
- automatically write import line to the buffer
- the line is added beside others imports
- the specifier is the camelcased filename
- removes index.js and extensions
- select parent folder name when index.js is imported
- the path is computed automatically
- paths are resolved successfully from relative modules (eg : file:../commons in package.json)
