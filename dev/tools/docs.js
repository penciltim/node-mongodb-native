var fs = require('fs'),
  dox = require('dox'),
  parseJS = require('uglify-js').parser,
  ejs = require('ejs'),
  exec = require('child_process').exec,
  format = require('util').format;

// Parses all the files and extracts the dox data for the library
exports.extractLibraryMetaData = function(sourceFiles) {
  var dataObjects = {};
  // Iterate over all source files
  for(var i = 0; i < sourceFiles.length; i++) {
    // Read source file content
    var sourceFile = fs.readFileSync(sourceFiles[i].path);
    // Parse the content
    var metaData = dox.parseComments(sourceFile.toString());
    // Save the metadata
    dataObjects[sourceFiles[i]["tag"] != null ? sourceFiles[i].tag : i] = metaData;
  }
  
  // Return all objects
  return dataObjects;
}

// Build a hash to easy access to the objects
exports.buildTestHash = function(objects) {
  // Organize the objects by class-function so we can query them
  var objectsByClassAndMethod = {};
  var objectKeys = Object.keys(objects);
  
  // Get all the objects
  for(var i = 0; i < objectKeys.length; i++) {
    // Get the object with the metadata
    var object = objects[objectKeys[i]];
    // Go through each example and pull them out
    for(var j = 0; j < object.length; j++) {
      var block = object[j];
      var tags = block.tags;

      // Build a class type
      var tagObject = {};
      
      // Check for the _class tag
      for(var tagIndex = 0; tagIndex < tags.length; tagIndex++) {
        // Get the tag
        var tag = tags[tagIndex];
        // Grab the tag if it's got it
        if(tag['type'] != null && tag['string'] != null) {
          tagObject[tag['type']] = tag['string'];
        }
      }
      
      // Check if we have the tags _class and _function signaling a test
      if(tagObject['_class'] != null && tagObject['_function'] != null) {
        // Add a class reference if none exists
        if(objectsByClassAndMethod[tagObject['_class']] == null) {
          objectsByClassAndMethod[tagObject['_class']] = {};
        }
        
        // Add a method reference if none exists
        if(objectsByClassAndMethod[tagObject['_class']][tagObject['_function']] == null) {
          objectsByClassAndMethod[tagObject['_class']][tagObject['_function']] = [];
        }

        // Push the object on the list
        objectsByClassAndMethod[tagObject['_class']][tagObject['_function']].push(block);          
        
        // Format the block code
        var codeLines = block.code.split(/\n/);
        // Drop first and last line
        codeLines = codeLines.slice(1, codeLines.length - 1);
        // Indent the code
        for(var k = 0; k < codeLines.length; k++) {
          codeLines[k] = codeLines[k].replace(/^  /, "")
        }
        // Reasign the code block
        block.code = codeLines.join("\n");
      }
    }
  }
  
  // Return the object mapped by _class and _function
  return objectsByClassAndMethod;
}

// Render all the templates
exports.renderAllTemplates = function(outputDirectory, templates, dataObjects, testObjects, attributeTags) {
  // Helper methods used in the rendering
  var isClass = function(tags) {    
    for(var k = 0; k < tags.length; k++) {
      if(tags[k].type == 'class') return true;
    }    
    return false;
  }
  
  var isFunction = function(entry) {
    return entry.ctx != null && entry.ctx.type == 'method' && entry.isPrivate == false;
  }
  
  var isProperty = function(entry) {
    var tags = entry.tags;    
    for(var k = 0; k < tags.length; k++) {
      if(tags[k].type == 'property') return true;
    }    
    return false;    
  }
  
  var isClassConstant = function(entry) {
    var tags = entry.tags;    
    for(var k = 0; k < tags.length; k++) {
      if(tags[k].type == 'classconstant') return true;
    }    
    return false;    
  }
  
  // Iterate over all classes
  var classNames = Object.keys(dataObjects);
  
  // For each class generate output
  for(var i = 0; i < classNames.length; i++) {
    var className = classNames[i];
    // The meta data object
    var classMetaData = dataObjects[className];
    // Grab the examples for this Metadata class
    var classExamplesData = testObjects[className];
    // Render the class template
    var classContent = ejs.render(templates['class'], 
      {entries:classMetaData, examples:classExamplesData, isClass:isClass, 
        isFunction:isFunction, isProperty:isProperty, isClassConstant:isClassConstant, 
        format:format});
    // Write out the content to disk
    fs.writeFileSync(format("%s/%s.rst", outputDirectory, className), classContent);
  }
  
  // Let's render the index api file
  var indexContent = ejs.render(templates['index'], 
    {entries:classNames, isClass:isClass, isFunction:isFunction, isProperty:isProperty, 
      isClassConstant:isClassConstant, format:format, title:attributeTags['index_title']});    
  // Write out the api index to disk
  fs.writeFileSync(format("%s/%s.rst", outputDirectory, "index"), indexContent);
}

// Read all the templates
exports.readAllTemplates = function(templates) {
  var finishedTemplates = {};
  // Read in all the templates
  for(var i = 0; i < templates.length; i++) {
    finishedTemplates[templates[i].tag] = fs.readFileSync(templates[i].path).toString();
  }
  
  // Return the finished templates
  return finishedTemplates;
}