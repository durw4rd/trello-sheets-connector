/* TODO: 
 * 1. Figure out the drop-down custom fields -> done for CSM
 * 2. Fix phase -> done
 * 3. Set up regular update interval -> semi-done
 * 4. Add card ID -> done
 * 5. Changes to custom fields? (health start, health end)
 */


// CHANGE: Update as necessary
var trelloKey = '7c5c0c267c10c3d6464453cbf537b3c2';
var trelloToken = '5e16e9199735744d815eb53b79bc67102e26dfb883d287407f75b9bd9b802244';

/*
 * Function to make requests to Trello API
 * Accepts string as the first parameter to determine the URL path of the request 
 * Accepts object as the second parameter to determine URL query parameters.
 * If the second parameter is not provided, it defaults to the authentication key & token params only.
 */
function fetchTrelloAPI(urlPath, urlParams = { key: trelloKey, token: trelloToken }) {
  // CHANGE: Provide Trello board ID
  var boardId = "NAni9fgm";
  var baseTrelloAPIUrl = 'https://api.trello.com';
  function generateQueryString(parameters) {
   const params = [];
   for (var p in parameters)
    params.push(encodeURIComponent(p) + '=' + encodeURIComponent(parameters[p]));
   return  params.join('&');
  }
  var paramsString = generateQueryString(urlParams);

  var requestUrl = baseTrelloAPIUrl + '/1/boards/' + boardId + urlPath + '?' + paramsString;
  // Logger.log(requestUrl);
  var requestOptions = {
    method: 'get',
    headers: {
      'Accept': '*/*',
    }
  };
  Logger.log(requestUrl);
  var rawResponse = UrlFetchApp.fetch(requestUrl, requestOptions)
  var parsedResponse = JSON.parse(rawResponse.getContentText());
  // Logger.log(parsedResponse);
  return parsedResponse;
};

function fetchCustomField(urlPath, urlParams = { key: trelloKey, token: trelloToken }) {
  var baseTrelloAPIUrl = 'https://api.trello.com';
  function generateQueryString(parameters) {
   const params = [];
   for (var p in parameters)
    params.push(encodeURIComponent(p) + '=' + encodeURIComponent(parameters[p]));
    return  params.join('&');
  }
  var paramsString = generateQueryString(urlParams);

  var requestUrl = baseTrelloAPIUrl + '/1' + urlPath + '?' + paramsString;
  // Logger.log(requestUrl);
  var requestOptions = {
    method: 'get',
    headers: {
      'Accept': '*/*',
    }
  };
  Logger.log(requestUrl);
  var rawResponse = UrlFetchApp.fetch(requestUrl, requestOptions)
  var parsedResponse = JSON.parse(rawResponse.getContentText());
  // Logger.log(parsedResponse);
  return parsedResponse;
};

var paramsDataCards = {
  key: trelloKey,
  token: trelloToken,
  customFieldItems: true,
  actions: "commentCard",
  members: "true",
  member_fields: "fullName",
  checklists: "all",
  checkItemStates: "true",
  fields: "name,idList,labels,dateLastActivity,shortUrl,idShort"
};


function syncTrelloToSheets() {
  var CSETrelloSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Raw data");
  CSETrelloSheet.clear({contentsOnly: true});

  var cards = fetchTrelloAPI('/cards/', paramsDataCards);
  var lists = fetchTrelloAPI('/lists/');
  var customFields = fetchTrelloAPI('/customFields/');
  // var csmCustomFieldOptions = fetchCustomField('/customFields/607460501dcf4a497342fe27/options/');

  // Logger.log(customFields);
  // Logger.log(csmCustomFieldOptions);

  // Turn original card object into something that makes sense in the spreadsheet
  var toInput = cards.map(card => {
    var newCard = {};
    Object.keys(card).map(cardObjectKey => {
      
      // Takes list name and assigns it as a 'phase' prop to the newCard object
      if (cardObjectKey === "idList") {
        listname = lists.filter(list => {
          return list.id === card[cardObjectKey]
        });
        newCard["phase"] = listname[0].name;
        return false;
      }

      // Copies the keys that are not 'object' nor 'array' type as is
      if (typeof card[cardObjectKey] !== "object" && typeof card[cardObjectKey] !== "array") {
        newCard[cardObjectKey] = card[cardObjectKey];
      }

      // Work with members on a card
      newCard["members"] = card.members.map(member => member.fullName).join("\n");
      newCard["labels"] = card.labels.map(label => label.name).join(" | ");

      // Transforms the custom fields object into separate keys in the newCard object
      if (cardObjectKey === "customFieldItems") {
        card[cardObjectKey].map(customField => {
          
          // Value needs to be retrieved before the filter fn below is executed          
          var fieldValue = customField.value || customField.idValue;
          
          var customField = customFields.filter(cf => {
            return cf.id === customField.idCustomField
          });

          if(customField[0].name === "CSM") {
            switch (fieldValue) {
              case "607460501dcf4a497342fe29":
                fieldValue = {text: "Tanka"}
                break;
              case "607460501dcf4a497342fe2b":
                fieldValue = {text: "Andrea"}
                break;
              case "607460501dcf4a497342fe2c":
                fieldValue = {text: "Maddie"}
                break;
              case "607460501dcf4a497342fe2d":
                fieldValue = {text: "Justin"}
                break;
              case "60a77b4f6c1b471fb5c34f90":
                fieldValue = {text: "Emily"}
                break;
              case "60c349608300052ad3b1b0cd":
                fieldValue = {text: "Ed"}
                break;
            }
          }
          newCard[customField[0].name] = fieldValue[Object.keys(fieldValue)[0]]
        });
      }
    });

    // newCard["notes"] = card.actions.map(action => {
    //   var date = new Date(action.date);
    //   var text = `[${date.getMonth()}/${date.getDate()}][${action.memberCreator.fullName}] ${action.data.text}`;
    //   return text;
    // }).join("\n");

    Object.keys(newCard).map(k => {
      // Convert timestamps
      let re = new RegExp('[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])');
      if (re.test(newCard[k])) {
        newCard[k] = newCard[k].match(re)[0]
      }
    });
    return newCard;
  });

  // Append headers row
  var headerArray = ['ID', 'Name', 'Phase', 'Last Activity', 'Short URL', 'Members', 'Labels', 'Customer Name', 'Account ID', 'Hours Spent', 'CSM', 'Start Date', 'Close Date']
  CSETrelloSheet.appendRow(headerArray);

  // Append row for every card on the board
  toInput.forEach(card => {
    if(card.name !== '[Reactive engagement]' && card.name !== '[Proactive engagement]') {
      CSETrelloSheet.appendRow([parseInt(card.idShort), card.name, card.phase, card.dateLastActivity, card.shortUrl, card.members, card.labels, card['Customer Name'], card['Account ID'], card['Hours spent'], card['CSM'], card['Start date'], card['Close date']]);
    }
  });
}

function onOpen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var menuEntries = [ {name: "Update from Trello", functionName: "syncTrelloToSheets"},];
  ss.addMenu("Trello", menuEntries);
}
