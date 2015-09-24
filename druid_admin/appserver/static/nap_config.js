
window._currentApp = false;
window._selectedapp = false;


var RENAME  = '| eval end_alert=if(alert="YES","NO","YES") |strcat start_time ":" alert ":start," end_time ":" end_alert ":end" fields | makemv delim="," fields | mvexpand fields | rex field=fields "(?<starttime>.+):(?<alert>.+):(?<type>.+)" | eval comment=if(type="end", "", comment) | table starttime tsmserver node napid type alert comment'; // rules to regenerate the content of the file according to the displayed data
var RRENAME = '| stats first(eval(if(type="start", starttime, NULL))) AS start_time first(eval(if(type="start", alert, NULL))) AS alert first(eval(if(type="end", starttime, NULL))) AS end_time first(eval(if(type="start", comment, NULL))) AS comment by napid,tsmserver,node'; // rules to generate the displayed table according to the lookup content
// SHOULD BE THE SAME AS THE SEARCH IN THE XML VIEW

var HEADERS = {'tsmserver': "TSM Server",
               'node': "Node",
               'start_time': "Start Time",
               'end_time': "End Time",
               'alert': "Alert",
               'comment': "Comment",
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

        Sideview.utils.declareCustomBehavior("receivePushesForRowDeletes", function(searchModule) {
            if (window.__rowDeleter) {
                console.error("receivePushesForRowDeletes - hees already got one");
            }
            window.__rowDeleter = searchModule;
        });

        Sideview.utils.declareCustomBehavior("receivePushesForRowAdditions", function(searchModule) {
            if (window.__rowAdder) {
                console.error("receivePushesForRowAdditions - hees already got one");
            }
            window.__rowAdder = searchModule;
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
            tableModule.onResultsRendered = function() {
                var addButton = $("<button>")
                    .addClass("splButton-secondary")
                    .addClass("addrow")
                    .text("Add new row")
                    .click(this.onAddRowClick.bind(this));

                this.resultsContainer.append(addButton);
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

                if (field == 'alert') {
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

                if (field.indexOf("_time", field.length - 5) !== -1) {
                    this.addTimePicker(field, value, input, td, tr);
                } else if (field == "comment") {

                } else { // only modify time based inputs
                    input.val(value).prop("readonly", true);
                }

                td.append(input);
                tr.append(td);
            }

            tableModule.addTimePicker = function(field, value, input, td, tr) {
                // endXXXXtime should be set to 23:59 on that day and not 0:0
                // and default should be in 90 days
                var default_date = "+0d";
                var time_offset = 0;
                if (field.indexOf("end", 0) !== -1) {
                    time_offset = 86399;
                    default_date = "+90d";
                } else if(value) { // start_time written as napid-start_time
                    //console.log(value);
                    var myvalues = value[0].split("-");
                    var napid = myvalues[0];
                    value = myvalues[1];
                    var ninput = $("<input>").attr("type", "text");
                    ninput.val(napid).attr("s:field", "napid");
                    ninput.val(napid).attr("s:oldValue", napid);
                    ninput.val(napid).attr("type", "hidden");
                    td.append(ninput);
                    input.val(value).attr("s:oldValue",value); // value has changed
                }
                input.val(value).attr("type", "hidden");

                var dinput = $("<input>").attr("type", "text");
                dinput.val(value).attr("nocheck","true");
                dinput.val(value).attr("id", _.uniqueId(field+"-"));
                var mindate = 0;
                if (field == "end_time") {
                    if (value) {
                        tr.find("input").each(function() {
                            if ($(this).attr("id") && $(this).attr("id").indexOf("start", 0) !== -1) {
                                var mydate = $.datepicker.parseDate('@', value*1000);
                                $(this).datepicker("option", "maxDate", mydate);
                            }
                        });
                    }
                    tr.find("input").each(function() {
                        if ($(this).attr("s:field") && $(this).attr("s:field").indexOf("start", 0) !== -1) {
                            if ($(this).attr("value"))
                                var mydate = $(this).attr("value");
                            mindate =  $.datepicker.parseDate('@', mydate*1000);
                        }
                    });
                }
                dinput.val(value).datepicker({
                    changeMonth: true,
                    changeYear: true,
                    dateFormat: "yy-mm-dd",
                    firstDay: 1,
                    defaultDate: default_date,
                    prevText: "",
                    nextText: "",
                    onSelect : function(dateText, inst) {
                       var me = $(this);
                       var row = $(me.parents("tr")[0]);
                       if (time_offset == 0) { // it is start time
                           row.find("input").each(function() {
                               if ($(this).attr("id") && $(this).attr("id").indexOf("end", 0) !== -1) {
                                   $(this).datepicker("option", "minDate", new Date(dateText));
                               }
                           });
                       } else { // it is end time
                           row.find("input").each(function() {
                               if ($(this).attr("id") && $(this).attr("id").indexOf("start", 0) !== -1) {
                                   $(this).datepicker("option", "maxDate", new Date(dateText));
                               }
                           });
                       }

                       var epoch = $.datepicker.formatDate('@', $(this).datepicker('getDate')) / 1000 + time_offset;
                       input.val(value).val(epoch);
                       input.keyup();
                    }
                });
                if (value) {
                    if (mindate !== 0) {
                        dinput.val(value).datepicker("option", "minDate", mindate);
                    }
                    d = $.datepicker.parseDate('@', value*1000);
                    dinput.val(value).datepicker('setDate', d);
                } else {
                    dinput.datepicker('setDate', default_date);
                    input.attr("value", $.datepicker.formatDate('@', dinput.datepicker('getDate')) / 1000 + time_offset);
                }

                td.append(dinput);
            }

            tableModule.getBaseMatchingSearch = function(lookupName,oldValueDict) {
                var s = [];
                s.push("| inputlookup " + lookupName + RRENAME);
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
                        evalStatements.push('eval ' + key + '=if(zomgItsOurRow=="1","' + newValueDict[key] + '",' + key + ')')
                    }
                }
                s.push(" | " + evalStatements.join(" | "));
                s.push(" | fields - zomgItsOurRow ");
                s.push(RENAME + " | outputlookup " + lookupName);
                return s.join("");
            }

            tableModule.getRowDeleteSearch = function(lookupName,oldValueDict) {
                var s = this.getBaseMatchingSearch(lookupName, oldValueDict);
                s.push("| search NOT zomgItsOurRow=1");
                s.push(" | fields - zomgItsOurRow ");
                s.push(RENAME + " | outputlookup " + lookupName);
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

            tableModule.onDeleteClick = function(evt) {
                var button = $(evt.target);
                oldValueDict = {};
                $(button.parents("tr")[0]).find("input, select").each(function() {
                    var field = $(this).attr("s:field");
                    if (!field) { return; }

                    var oldValue = $(this).attr("s:oldValue") || "";
                    oldValueDict[field] = oldValue;
                });
                var context = this.getContext();
                var lookupName = context.get("lookupName.rawValue");
                var s = this.getRowDeleteSearch(lookupName,oldValueDict);

                window.__rowDeleter._params["search"] = s;
                window.__rowDeleter.pushContextToChildren();
            }

            tableModule.onAddClick = function(evt) {
                var button = $(evt.target);

                var values = {};
                $(button.parents("tr")[0]).find("input, select").each(function() {
                    var field = $(this).attr("s:field");
                    if (!field) { return; }

                    values[field] = $(this).val();
                });

                var context = this.getContext();
                var lookupName = context.get("lookupName.rawValue");

                var s = [];
                s.push("| inputlookup nodeinfo");
                if (values.hasOwnProperty("node") && values["node"]!="" && values.hasOwnProperty("tsmserver") && values["tsmserver"]!="") {
                    values["node"] = values["node"].toUpperCase();
                    values["tsmserver"] = values["tsmserver"].toUpperCase();
                    s.push('| search tsmserver="' + values["tsmserver"] + '" AND NODE_NAME="' + values["node"] +'"');
                } else { // nothing to add...
                    return context;
                }
                s.push('| stats first(ALERTS_DEFAULT) AS end_alert by tsmserver,NODE_NAME | eval node=NODE_NAME | eval alert=if(end_alert="YES","NO","YES") | eval start_time=floor(strptime(strftime(now(), "%Y-%m-%d"), "%Y-%m-%d")) | eval end_time=floor(strptime(strftime(relative_time(now(), "+90d@d" ), "%Y-%m-%d"), "%Y-%m-%d")+86399) | join [|inputlookup nodealerts | stats max(napid) AS max | eval napid = max+1] |strcat start_time ":" alert ":start," end_time ":" end_alert ":end" fields | makemv delim="," fields | mvexpand fields | rex field=fields "(?<starttime>.+):(?<alert>.+):(?<type>.+)"');
                s.push('| eval comment=if(type="start", "'+values["comment"]+'", "")');
                s.push('| table starttime tsmserver node napid type alert comment | inputlookup append=t nodealerts | sort + napid');
                s.push("| outputlookup " + lookupName);

                window.__rowAdder._params["search"] = s.join("");
                window.__rowAdder.pushContextToChildren();
            };

            tableModule.onAddRowClick = function(evt) {
                var row = $("<tr>");
                var that = this;
                $.each(HEADERS, function( field ) {
                    var td = $("<td>");
                    if (field == 'alert') {
                        var input = $("<select>")
                            .append($("<option>").val("YES").text("Yes"))
                            .append($("<option>").val("NO").text("No"))
                            .val("NO")
                            .change(function(e) {
                                var me = $(this);
                                var row = $(me.parents("tr")[0]);
                                var button = $(me.parents("tr")[0]).find("button.add");

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
                                var button = $(me.parents("tr")[0]).find("button.add");

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

                   input.attr("s:field", field);

                    if (field.indexOf("_time", field.length - 5) !== -1) {
                        that.addTimePicker(field, null, input, td, row);
                    }

                    td.append(input);
                    row.append(td);
                });

                var addButton = $("<button>")
                    .addClass("splButton-secondary")
                    .addClass("add")
                    .text("Add")
                    .click(this.onAddClick.bind(this));
                var deleteButton = $("<button>")
                    .addClass("splButton-secondary")
                    .addClass("delete")
                    .text("Delete")
                    .click(this.onDeleteClick.bind(this));

                var buttonCell = $("<td>")
                    .append(addButton)
                    .append(deleteButton);
                row.append(buttonCell);

                // Create a table if there isn't one already...
                $('.emptyResults', this.resultsContainer).replaceWith(
                    $('<table>')
                        .addClass("splTable")
                        .append(function(index, html) {
                            var header = $("<tbody>").append($("<tr>"));
                            header.find("tr").append(_(HEADERS).map(function(label, field) {
                                return $("<th>").append($("<span>").attr("s:field", field).text(label));
                            }));

                            return header;
                        })
                );

                $('tbody', this.resultsContainer).append(row);
            }

            var methodReference = tableModule.renderRow.bind(tableModule);
            tableModule.renderRow = function(table,rowIndex, row, context) {
                var tr = methodReference(table,rowIndex, row, context);
                var editButton = $("<button>")
                    .addClass("splButton-secondary")
                    .addClass("update")
                    .text("Update")
                    .click(this.onEditClick.bind(this));
                var deleteButton = $("<button>")
                    .addClass("splButton-secondary")
                    .addClass("delete")
                    .text("Delete")
                    .click(this.onDeleteClick.bind(this));

                var buttonCell = $("<td>")
                    .append(editButton)
                    .append(deleteButton);
                tr.append(buttonCell);
                return tr;
            }
        });
    }
});
