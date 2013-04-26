
var jsonPathCompiler = (function () {

   /** 
    * tokenExprs is an array of pairs. Each pair contains a regular expression for matching a 
    * jsonpath language feature and a function for parsing that feature.
    */
   var tokenExprs = (function(){
      /**
       * Expression for a named path node. 
       *    foo
       *    ["foo"]
       *    [2]
       * 
       * @returns {Object|false} either the object that was found, or false if nothing was found
       */
      function namedNodeExpr(previousExpr, capturing, name, pathStack, nodeStack, stackIndex ) {
                     
         if( pathStack[stackIndex] != name ) {
            return false;
         }
      
         var previous = previousExpr(pathStack, nodeStack, stackIndex-1);
               
         return previous && returnValue(capturing, previous, nodeStack, stackIndex);         
      }
   
      /**
       * Expression for:
       *    *
       *    [*]
       * 
       * @returns {Object|false} either the object that was found, or false if nothing was found         
       */
      function anyNodeExpr(previousExpr, capturing, _nameless, pathStack, nodeStack, stackIndex ){
         var previous = previousExpr(pathStack, nodeStack, stackIndex-1);                   
                  
         return previous && returnValue(capturing, previous, nodeStack, stackIndex);
      }
      
      /**
       * Expression for .. (double dot) token              
       * 
       * @returns {Object|false} either the object that was found, or false if nothing was found         
       */   
      function multipleUnnamedNodesExpr(previousExpr, _neverCaptures, _nameless, pathStack, nodeStack, stackIndex ) {
               
         // past the start, not a match:
         if( stackIndex < -1 ) {
            return false;
         }
      
         return stackIndex == -1 || // -1 is the root 
                previousExpr(pathStack, nodeStack, stackIndex) || 
                multipleUnnamedNodesExpr(previousExpr, _neverCaptures, _nameless, pathStack, nodeStack, stackIndex-1);         
      }      
      
      /**
       * Expression for $ - matches only the root element of the json
       * 
       * @returns {Object|false} either the object that was found, or false if nothing was found         
       */   
      function rootExpr(_cantHaveExprsBeforeRoot, capturing, _nameless, pathStack, nodeStack, stackIndex ){
         return stackIndex == -1 && returnValue(capturing, true, nodeStack, stackIndex);
      }   
      
      /**
       * Expression for . does no tests since . is just a seperator. Just passes through to the
       * next function in the chain.
       * 
       * @returns {Object|false} either the object that was found, or false if nothing was found         
       */   
      function passthroughExpr(previousExpr, _neverCaptures, _nameless, pathStack, nodeStack, stackIndex) {
         return previousExpr(pathStack, nodeStack, stackIndex);
      }   
           
      /** extraction of some common logic used by expression when they have matched.
       *  If is a capturing node, will return it's item on the nodestack. Otherwise, will return the item
       *  from the nodestack given by the previous expression, or true if none
       */
      function returnValue(capturing, previousExprEvaluation, nodeStack, stackIndex) {
         return capturing? nodeStack[stackIndex+1] : (previousExprEvaluation || true);
      }
           
      /**
       * Each of the sub-arrays has at index 0 a pattern matching the token.
       * At index 1 is the expression function to return a function to parse that expression
       */
      function tokenExpr(pattern, parser) {
         return {pattern:pattern, parser:parser};
      }     
      
      return [
         tokenExpr(/^(\$?)(\w+)/        , namedNodeExpr),
         tokenExpr(/^(\$?)\[(\d+)\]/    , namedNodeExpr),
         tokenExpr(/^(\$?)\["(\w+)"\]/  , namedNodeExpr),
         tokenExpr(/^\.\./              , multipleUnnamedNodesExpr),
         tokenExpr(/^(\$?)!/            , rootExpr),      
         tokenExpr(/^(\$?)\*/           , anyNodeExpr),
         tokenExpr(/^(\$?)\[\*\]/       , anyNodeExpr),      
         tokenExpr(/^\./                , passthroughExpr)
      ];
   })(); // end of tokenExprs definition
   
   
   /**
    * Given a parser for a token, parse the statement ending in that token against a pathStack
    * 
    * @returns {Object|false} either the object that was found, or false if nothing was found         
    */   
   function statement(expr, pathStack, nodeStack){
   
      var exprMatch = expr(pathStack, nodeStack, pathStack.length-1);
                            
      // Returning exactly true indicates that there has been a match but no node is captured. 
      // By default, the node at the top of the stack gets returned. Just like in css4 selector 
      // spec, if there is no $, the last node in the selector is the one being styled.                      
                      
      return exprMatch === true ? lastOf(nodeStack) : exprMatch;
   }   

   /** 
    * compile the next part of a jsonPath
    */
   function compileNextToken( jsonPath, compiledSoFar ) {
                
      for (var i = 0; i < tokenExprs.length; i++) {
         var tokenMatch = tokenExprs[i].pattern.exec(jsonPath);
             
         if(tokenMatch) {
            var capturing = !!tokenMatch[1],
                name = tokenMatch[2],
                parser = tokenExprs[i].parser.bind(null, compiledSoFar, capturing, name),
                remainingString = jsonPath.substr(tokenMatch[0].length);
         
            return remainingString? compileNextToken(remainingString, parser) : parser;
         }
      }
      
      // couldn't find any match, jsonPath is probably invalid:
      throw Error('got stuck at "' + jsonPath + '"');      
   }

   /**
    * A function that, given a jsonPath string, returns a function that tests against that
    * jsonPath.
    * 
    *    String -> (String[] -> Boolean)
    */
   return function (jsonPath) {        
      try {        
         return statement.bind(null, compileNextToken(jsonPath, function(){return true}));
      } catch( e ) {
         throw Error('Could not compile "' + jsonPath + '" because ' + e);
      }
   };
   
})();
