# Stippling

##Project progress:

###Implemented:
3 main stippling techniques

###Pending:
Color Mapping, Shapes, adjustable variables

##Notes:
Placeholder adjustments are currently greyed in the frontend.

##Want new data for the dropdown?
- Add files to dataprocessing/data folder
- Adjust main.py accordingly
- Adjust data_utility.js:init_data()
- Adjust dropdown in index.html

##JSDoc
Installation (e.g. WebStorm Terminal):
````
npm install --save-dev jsdoc
````

Create command:
````
./node_modules/.bin/jsdoc code.js res/data_utility.js
````
Private methods/properties are not included, maybe we can fix that?