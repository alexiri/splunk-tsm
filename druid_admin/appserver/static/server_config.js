
window._currentApp = false;
window._selectedapp = false;


var HEADERS = {'TSMSERVER': "TSM Server",
               'SERVER_TYPE': "Server Type",
               'SERVER_STATUS': "Status",
               'BUILDING': "Building",
               'USAGE': "Usage",
               'COMMENT': "Comment",
              } // change the title on top of the columns to more user friendly names according to the field names

var _ = require('underscore');

$(document).bind("javascriptClassesLoaded", function() {
    if (typeof(Sideview)!="undefined") {

        Sideview.utils.declareCustomBehavior("receivePushesForRowUpdates", function(searchModule) {
            if (window.__rowUpdater) {
                console.error("receivePushesForRowUpdates - hees already got one");
            }
            window.__rowUpdater = searchModule;
        });

        Sideview.utils.declareCustomBehavior("hookForReloadingLookup", function(module) {
            if (window.__reloader) {
                console.error("hookForReloadingLookup - hees already got one");
            }
            window.__reloader = module;
        });

        Sideview.utils.declareCustomBehavior("reloadEditedLookup", function(customBehaviorModule) {
            customBehaviorModule.onContextChange = function() {
                window.__reloader.pushContextToChildren();
            }
        });

        Sideview.utils.declareCustomBehavior("pushAppAndLookupName", function(customBehaviorModule) {
            customBehaviorModule.onContextChange = function() {
                var context = this.getContext();
            }
        });

        Sideview.utils.declareCustomBehavior("editableTable", function(tableModule) {
            tableModule.hasUncommittedChanges = function(row) {
                var retVal=false;
                row.find("input, select").each(function() {
                    var nocheck = $(this).attr("nocheck") || "false";
                    var oldValue = $(this).attr("s:oldValue") || "";
                    if ((nocheck == "false") && (oldValue != $(this).val())) {
                        retVal=true;
                        return false;
                    }
                });
                return retVal;
            }
            tableModule.renderColumnRow = function(response, tr) {
                tr.addClass("columnRow");

                for (var i=0,len=this.fieldOrder.length;i<len;i++) {
                    var fieldName = this.fieldOrder[i];
                    var prettyName = fieldName in HEADERS ? HEADERS[fieldName] : fieldName;
                    if (!this.hiddenFields.hasOwnProperty(fieldName)) {
                        var th = $("<th>");
                        th.append($("<span>").addClass("sortLabel").attr("s:field",fieldName).text(prettyName));
                        th.click(this.onSortClick.bind(this))
                        if (fieldName == this.activeSortField) {
                            th.addClass("activeSort");
                            if (!this.activeSortIsAscending) {
                                th.addClass("descending");
                            }
                        }
                        th.append($("<span>").addClass("sortArrow"));
                        tr.append(th);
                    }
                }
            }
            tableModule.renderDataCell = function(tr, field, value) {
                var tableModule = this;
                var td = $("<td>");

                if (_(['SERVER_STATUS', 'SERVER_TYPE', 'BUILDING']).contains(field)) {
                    var input = $("<select>");
                    if (field == 'SERVER_STATUS') {
                        input.append($("<option>").val("production").text("Production"))
                             .append($("<option>").val("test").text("Test"))
                             .append($("<option>").val("retired").text("Retired"));
                    } else if (field == 'SERVER_TYPE') {
                        input.append($("<option>").val("user").text("User server"))
                             .append($("<option>").val("library_manager").text("Library manager"));
                    } else if (field == 'BUILDING') {
                        input.append($("<option>").val("513").text("513"))
                             .append($("<option>").val("613").text("613"));
                    }

                    input.change(function(e) {
                        var me = $(this);
                        var row = $(me.parents("tr")[0]);
                        var button = $(me.parents("tr")[0]).find("button.update");

                        if (tableModule.hasUncommittedChanges(row)) {
                            button.removeClass("splButton-secondary");
                            button.addClass("splButton-primary");
                        } else {
                            button.removeClass("splButton-primary");
                            button.addClass("splButton-secondary");
                        }
                    });
                } else {
                    var input = $("<input>")
                        .keyup(function(e) {
                            var me = $(this);
                            var row = $(me.parents("tr")[0]);
                            var button = $(me.parents("tr")[0]).find("button.update");

                            if (tableModule.hasUncommittedChanges(row)) {
                                button.removeClass("splButton-secondary");
                                button.addClass("splButton-primary");
                            } else {
                                button.removeClass("splButton-primary");
                                button.addClass("splButton-secondary");
                            }
                            if(e.which == 13) {
                                button.click();
                            }
                        });
                }

                input.attr("s:field",field);

                if (value) {
                    input.val(value).attr("s:oldValue", value);
                }

                if (field == "TSMSERVER") {
                    input.val(value).prop("readonly", true);
                }

                td.append(input);
                tr.append(td);
            }

            tableModule.getBaseMatchingSearch = function(lookupName,oldValueDict) {
                var s = [];
                s.push("| inputlookup " + lookupName);
                s.push("| eval zomgItsOurRow=if(");
                var condi = [];
                for (key in oldValueDict) {
                    if (oldValueDict.hasOwnProperty(key)) {
                        if (!oldValueDict[key] ) {
                            condi.push("(" + key + '=="' + oldValueDict[key] + '" OR isnull(' + key + '))');
                        } else {
                            condi.push(key + '=="' + oldValueDict[key] + '"');
                        }
                    }
                }
                s.push(condi.join(" AND "));
                s.push(',"1","0")');
                return s;
            }

            /**
             * uses these 2 dicts to create a big search string that does
             * | inputlookup
             * | eval zomgItsOurRow=if (every old value is the same)
             * | eval field1=if(zomgItsOurRow,newField1,field1)
             * | eval field2=if(zomgItsOurRow,newField1,field1)
             *   ...
             * | fields - zomgItsOurRow
             * | outputlookup
             */
            tableModule.getRowUpdateSearch = function(lookupName,oldValueDict,newValueDict) {
                var s = this.getBaseMatchingSearch(lookupName, oldValueDict);

                var evalStatements = []
                for (key in newValueDict) {
                    if (newValueDict.hasOwnProperty(key)) {
                        if (key.indexOf("_TIME", key.length - 5) !== -1 && newValueDict[key] == 0) {
                            evalStatements.push('eval ' + key + '=if(zomgItsOurRow=="1", NULL,' + key + ')')
                        } else {
                            evalStatements.push('eval ' + key + '=if(zomgItsOurRow=="1","' + newValueDict[key] + '",' + key + ')')
                        }
                    }
                }
                s.push(" | " + evalStatements.join(" | "));
                s.push(" | fields - zomgItsOurRow ");
                s.push(" | outputlookup " + lookupName);
                return s.join("");
            }

            tableModule.onEditClick = function(evt) {
                var button = $(evt.target);
                oldValueDict = {};
                newValueDict = {};
                $(button.parents("tr")[0]).find("input, select").each(function() {
                    var field = $(this).attr("s:field");
                    if (!field) { return; }

                    var newValue = $(this).val();
                    var oldValue = $(this).attr("s:oldValue") || "";

                    newValueDict[field] = newValue;
                    oldValueDict[field] = oldValue;
                });
                var context = this.getContext();
                var lookupName = context.get("lookupName.rawValue");
                //console.log(context);
                var s = this.getRowUpdateSearch(lookupName,oldValueDict, newValueDict);

                window.__rowUpdater._params["search"] = s;
                window.__rowUpdater.pushContextToChildren();
            }

            var methodReference = tableModule.renderRow.bind(tableModule);
            tableModule.renderRow = function(table,rowIndex, row, context) {
                var tr = methodReference(table,rowIndex, row, context);
                var editButton = $("<button>")
                    .addClass("splButton-secondary")
                    .addClass("update")
                    .text("Update")
                    .click(this.onEditClick.bind(this));

                var buttonCell = $("<td>")
                    .append(editButton);
                tr.append(buttonCell);
                return tr;
            }
        });
    }
});
