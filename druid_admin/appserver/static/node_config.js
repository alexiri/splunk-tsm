
window._currentApp = false;
window._selectedapp = false;


var HEADERS = {'tsmserver': "TSM Server",
               'NODE_NAME': "Node",
               'CONTACT': "Contact",
               'USER_GROUP': "User-defined Group",
               'USER_SUBGROUP': "User-defined Subgroup",
               'BACKUP_CYCLE': "Backup Cycle",
               'ALERTS_DEFAULT': "Default Alert state",
               'EXPIRE_TIME': "Expiration Date",
               'RETIRE_TIME': "Retire Date",
               'RETIRE_COMMENT': "Retire Comment",
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

                if (field == 'ALERTS_DEFAULT') {
                    var input = $("<select>")
                        .append($("<option>").val("YES").text("Yes"))
                        .append($("<option>").val("NO").text("No"))
                        .change(function(e) {
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

                if (field.indexOf("_TIME", field.length - 5) !== -1) {
                    this.addTimePicker(field, value, input, td, tr);
                } else if (_(["tsmserver", "NODE_NAME", "CONTACT"]).contains(field)) {
                    input.val(value).prop("readonly", true);
                }

                td.append(input);
                tr.append(td);
            }

            tableModule.addTimePicker = function(field, value, input, td, tr) {
                var time_offset = 0;

                if(value) {
                    input.val(value).attr("s:oldValue",value);
                }
                input.val(value).attr("type", "hidden");

                var dinput = $("<input>")
                        .attr("type", "text");
                dinput.val(value).attr("nocheck","true");
                dinput.val(value).attr("id", _.uniqueId(field+"-"));

                dinput.val(value).datepicker({
                    changeMonth: true,
                    changeYear: true,
                    dateFormat: "yy-mm-dd",
                    firstDay: 1,
                    minDate: new Date(),
                    prevText: "",
                    nextText: "",
                    onSelect : function(dateText, inst) {
                       var epoch = $.datepicker.formatDate('@', $(this).datepicker('getDate')) / 1000 + time_offset;
                       input.val(value).val(epoch);
                       input.keyup();
                    },
                });
                dinput.on("change", function(e) {
                    var d = $.datepicker.formatDate('@', $(e.target).datepicker('getDate')) / 1000 + time_offset;
                    input.val(d)
                    input.keyup();
                });
                if (value) {
                    d = $.datepicker.parseDate('@', value*1000);
                    dinput.val(value).datepicker('setDate', d);
                }

                td.append(dinput);
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
