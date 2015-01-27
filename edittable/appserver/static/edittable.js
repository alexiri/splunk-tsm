require([
    'jquery',
    'underscore',
    'splunkjs/mvc',
    'splunkjs/mvc/utils',
    'splunkjs/mvc/searchmanager',
    'splunkjs/mvc/simplexml/ready!',
], function($, _, mvc, utils, SearchManager) {

    (function($) {
        // Load extra stuff
        require(['app/edittable/contrib/jquery.color.plus-names-2.1.2.min'], function() {});

        $.fn.replaceVars = function(str, rowdata) {
            return str.replace(/\$([^\$]+)\$/g, function(m, c) {
                var d = _(rowdata).where({fieldname: c})[0]['original'];
                return (d != '*' ? d : '');
            });
        }

        $.fn.getBaseSearch = function(rowdata) {
            if (!this.data('lookup') || !rowdata) { return; }

            var q = '| inputlookup ' + this.data('lookup');
            if (this.data('presearch')) {
                q += ' | ' + this.replaceVars(this.data('presearch'), rowdata);
            }
            q += ' | eval zomgItsOurRow=if(';
            var condi = [];
            for (var i = 0; i < rowdata.length; i++) {
                if (!rowdata[i]['original']) {
                    condi.push('(' + rowdata[i]['fieldname'] + '=="" OR isnull(' + rowdata[i]['fieldname'] + '))');
                } else {
                    condi.push(rowdata[i]['fieldname'] + '=="' + rowdata[i]['original'] + '"');
                }
            }
            q += condi.join(' AND ') + ',"1","0")';

            return q;
        }

        $.fn.getOutputSearch = function(rowdata) {
            if (!this.data('lookup')) { return; }

            var q = ' | fields - zomgItsOurRow';
            if (this.data('postsearch')) {
                q += ' | ' + this.replaceVars(this.data('postsearch'), rowdata);
            }
            q += ' | outputlookup ' + this.data('lookup');

            return q;
        }

        $.fn.getPostAddSearch = function(rowdata) {
            if (!this.data('lookup')) { return; }

            var q = '';
            if (this.data('postaddsearch')) {
                q += ' | ' + this.replaceVars(this.data('postaddsearch'), rowdata);
            }
            return q;
        }

        $.fn.getRowData = function() {
            if (!$(this).is('td')) { return; }

            var row = $(this);
            var rowdata = [];
            for (var i = 0; i < row.length; i++) {
                if ($(row[i]).data('fieldname')) {
                    var input = $('input,select', row[i]);
                    if (input.hasClass("hasDatepicker")) {
                        // Got to convert the date to UTC first...
                        var local = input.datepicker('getDate');
                        if (local) {
                            var utc = new Date(0, 0);
                            utc.setUTCMinutes(0);
                            utc.setUTCHours(0);
                            utc.setUTCDate(local.getDate());
                            utc.setUTCMonth(local.getMonth());
                            utc.setUTCFullYear(local.getFullYear());
                            var newvalue = $.datepicker.formatDate('@', utc) / 1000;
                        } else {
                            var newvalue = null;
                        }
                    } else {
                        var newvalue = input.val();
                    }
                    rowdata.push({
                        'fieldname': $(row[i]).data('fieldname'),
                        'original': $(row[i]).data('original'),
                        'current': newvalue,
                    });
                }
            }

            return rowdata;
        }

        $.fn.decorateRow = function(i) {
            if (!$(this).is('tr')) { return; }

            $('th,td', this).each(function() {
                $(this).removeClass('numeric');
            });

            // Set up the 'delete' buttons
            if ($(i).data('allowdelete') == 'true') {
                // Don't add a delete button if we already have one
                if ($(this).children().hasClass('buttons')) {
                    return;
                }

                if ($(this).children().is('th')) {
                    $(this).append($('<th>').addClass('buttons'));
                } else {
                    var button = $('<button>')
                    .attr('type', 'button')
                    .addClass('btn btn-default delete')
                    .append($('<i>')
                        .addClass('icon-x')
                    )
                    .off('click')
                    .on('click', function(evt) {
                        var msg = "Are you sure you want to delete this item?\nThis action is not reversible.";
                        if (!confirm(msg)) {
                            return false;
                        }

                        var row = $(this).closest('tr').children();
                        var table = $(this).closest('table');

                        var q = $(i).getBaseSearch(row.getRowData());
                        q += ' | search NOT zomgItsOurRow=1';
                        q += $(i).getOutputSearch();

                        table.runSearch(q)
                        .on('search:done', function() {
                            var tr = $(this).closest('tr');
                            tr.detach();
                        }.bind(row));
                    });

                    $(this).append($('<td>')
                    .addClass('buttons')
                    .append(button)
                    );
                }
            }

            $('td:not(.row-number,.buttons)', this).each(function() {
                this.textContent = this.textContent.trim();
                $(this).data('original', this.textContent);
                var config = $(i).data('fields')[$(this).data('cell-index')];

                $(this).data('fieldname', config['fieldname']);
                $(this).data('readonly', config['readonly']);
                $(this).data('type', config['type']);

                // If the field is supposed to be readonly (and we're not adding a new field), we're done
                if ($(this).data('readonly') && !$(this).hasClass('add')) {
                    if (config.hasOwnProperty('type') && config['type'] == 'datepicker' && $(this).data('original')) {
                        $(this).text($.datepicker.formatDate('yy-mm-dd', $.datepicker.parseDate('@', $(this).data('original')*1000)));
                    }
                    return;
                }

                if ($(this).data('type') == 'dropdown') {
                    var input = $('<select>')
                        .addClass('dropdown');

                    if (config.hasOwnProperty('choice')) {
                        var choices = config['choice'];
                        if ((!$(this).data('original') || $(this).data('original') == "") && _(choices).where({value: ""}).length == 0) {
                            input.append($("<option>").val("").text(""));
                        }
                        for (var x = 0; x < choices.length; x++) {
                            input.append($("<option>").val(choices[x]['value']).text(choices[x]['label']));
                        }
                    }

                    if (config.hasOwnProperty('dropdown') && config['dropdown'].hasOwnProperty('query')) {
                        var data = $(this).runSearch(config['dropdown']['query'])
                            .data('results', {count: 0,output_mode: 'json'});

                        data.on('data', function(r) {
                            if (r.data().results) {
                                var d = r.data().results;
                                var config = $(i).data('fields')[$(this).data('cell-index')];
                                var select = $('select', this);

                                for(var x = 0; x < d.length; x++)  {
                                    if (config['dropdown']['value']) {
                                        var value = d[x][config['dropdown']['value']];
                                    } else {
                                        var value = d[x][Object.keys(d[x])[0]];
                                    }
                                    if (config['dropdown']['label']) {
                                        var label = d[x][config['dropdown']['label']];
                                    } else {
                                        var label = value;
                                    }

                                    select.append($("<option>").val(value).text(label));
                                }
                            }
                        }.bind(this));

                    }

                    input.val($(this).data('original'));

                } else if ($(this).data('type') == 'datepicker') {
                    var input = $('<input>')
                    .datepicker({
                        changeMonth: true,
                        changeYear: true,
                        dateFormat: "yy-mm-dd",
                        firstDay: 1,
                        prevText: "",
                        nextText: "",
                        onClose: function(selectedDate) {
                            $(this).val($.datepicker.formatDate('yy-mm-dd', $(this).datepicker('getDate')));

                            var td = $(this).parent();
                            var config = $(i).data('fields')[td.data('cell-index')];

                            if (config.hasOwnProperty('datepicker')) {
                                var others = $('.hasDatepicker', td.siblings());
                                if (config['datepicker'].hasOwnProperty('startdate')) {
                                    for(var x=0; x < others.length; x++) {
                                        if ($(others[x]).parent().data('fieldname') == config['datepicker']['startdate']) {
                                            $(others[x]).datepicker( "option", "maxDate", selectedDate );
                                        }
                                    }
                                }
                                if (config['datepicker'].hasOwnProperty('enddate')) {
                                    for(var x=0; x < others.length; x++) {
                                        if ($(others[x]).parent().data('fieldname') == config['datepicker']['enddate']) {
                                            $(others[x]).datepicker( "option", "minDate", selectedDate );
                                        }
                                    }
                                }
                            }
                        },
                    })
                    .keyup(function(e) {
                        if (e.which === 13) { // Enter pressed
                            // So conside that we're done
                            $(e.target).blur();
                        }
                    });

                    if ($(this).data('original')) {
                        var d = $.datepicker.parseDate('@', $(this).data('original') * 1000);
                        input.val($(this).data('original')).datepicker('setDate', d);
                    }

                    if (config.hasOwnProperty('datepicker')) {
                        if (config['datepicker'].hasOwnProperty('mindate')) {
                            input.datepicker("option", "minDate", config['datepicker']['mindate']);
                        }
                        if (config['datepicker'].hasOwnProperty('maxdate')) {
                            input.datepicker("option", "minDate", config['datepicker']['maxdate']);
                        }

                        var others = $('.hasDatepicker', $(this).siblings());
                        if (config['datepicker'].hasOwnProperty('startdate')) {
                            for(var x=0; x < others.length; x++) {
                                if ($(others[x]).parent().data('fieldname') == config['datepicker']['startdate']) {
                                    $(others[x]).datepicker( "option", "maxDate", input.datepicker('getDate') );
                                }
                            }
                        }
                        if (config['datepicker'].hasOwnProperty('enddate')) {
                            for(var x=0; x < others.length; x++) {
                                if ($(others[x]).parent().data('fieldname') == config['datepicker']['enddate']) {
                                    $(others[x]).datepicker( "option", "minDate", input.datepicker('getDate') );
                                }
                            }
                        }
                    }

                } else {
                    var input = $('<input>')
                    .keyup(function(e) {
                        if (e.which === 13) { // Enter pressed
                            // So conside that we're done
                            $(e.target).blur();
                        }
                    })
                    .val($(this).data('original'));

                    if ($(this).data('type') == 'numeric') {
                        input.on('change', function(evt) {
                            var valid = true;
                            var field = $(i).data('fields')[$(this).parent().data('cell-index')];
                            var allowempty = (field['allownull'] == 'false' ? false: true);
                            var greater = null;
                            try { greater = field['numeric']['greaterthan']; } catch(e) {}
                            var smaller = null;
                            try { smaller = field['numeric']['smallerthan']; } catch(e) {}

                            if ((!allowempty && $(this).val() == '') || !jQuery.isNumeric($(this).val())) {
                                valid = false;
                            } else {
                                var val = parseFloat($(this).val());

                                if ((greater && val <= greater) || (smaller && val >= smaller)) {
                                    valid = false;
                                }
                            }

                            if (!valid) {
                                evt.preventDefault();
                                $(this).val($(this).parent().data('original'));

                                var oldColor = $(this).parent().siblings().css('background-color');
                                $(this).animate({'background-color': 'red'}, 'fast');
                                $(this).animate({'background-color': oldColor}, 'fast');
                            }

                            return valid;
                        });
                    }
                }

                $(this).empty();
                $(this).append(input);

                if ($(this).hasClass('add')) { return; }
                $(this).on('change', function(evt) {
                    console.log("cell changed!");
                    var cell = $(this);
                    var row = cell.closest("tr").children();
                    var table = cell.closest("table");

                    if (cell.data('readonly')) { return false; }

                    var rowData = row.getRowData();

                    var newvalue = rowData[cell.data('cell-index')].current;
                    if (cell.data('original') == newvalue) { return false; }
                    var allowempty = ($(i).data('fields')[cell.data('cell-index')]['allownull'] == 'false' ? false: true);
                    if (!allowempty && !newvalue) {
                        var input = $('input,select', cell);
                        if (input.hasClass('hasDatepicker')) {
                            var d = $.datepicker.parseDate('@', cell.data('original') * 1000);
                            input.val(cell.data('original')).datepicker('setDate', d);
                        } else {
                            input.val(cell.data('original'));
                        }

                        var oldColor = row.css('background-color');
                        $(this).animate({'background-color': 'red'}, 'fast');
                        $(this).animate({'background-color': oldColor}, 'fast');
                        return false;
                    }

                    cell.data('newvalue', newvalue);
                    console.log("Old value: ", cell.data('original'));
                    console.log("New value: ", newvalue);

                    var q = $(i).getBaseSearch(rowData);
                    q += ' | eval ' + cell.data('fieldname') + '=if(zomgItsOurRow=="1", '
                    if (newvalue) {
                        q += '"' + newvalue + '"'
                    } else {
                        q += 'null'
                    }
                    q += ', ' + cell.data('fieldname') + ')';
                    q += $(i).getOutputSearch(rowData);

                    var data = table.runSearch(q)
                    .on('search:done', function() {
                        // There's a new 'original' value
                        this.data("original", this.data("newvalue"));
                        this.removeData("newvalue");

                        var oldColor = this.siblings().css('background-color');
                        this.animate({'background-color': 'green'}, 'fast');
                        this.animate({'background-color': oldColor}, 'fast');
                    }.bind(cell))
                    .data('results', {count: 0,output_mode: 'json'});

                    data.on('data', function(r) {
                        if (r.data().results) {
                            console.log('length:', r.data().results.length);
                            console.log(r.data().results[0]);
                        }
                    });
                });

            });
        }

        $.fn.runSearch = function(q) {
            console.log('Running search:', q);
            var search = new SearchManager({
                "id": _.uniqueId("search-"),
                "earliest_time": '-1h',
                "latest_time": 'now',
                "cancelOnUnload": true,
                "search": q,
                "app": utils.getCurrentApp(),
                "data": "results",
                "cache": false,
                "preview": false,
            }, {tokens: true,tokenNamespace: "submitted"});

            search.on('search:done', function() {
                console.log(' * Search done.');
            })
            .on('search:failed', function() {
                console.log(' * Search failed.');
            })

            return search;
        }

        $.fn.editTable = function(id) {
            var i = mvc.Components.get(id);
            if (i) {

                $(i).data('lookup', i.options['table.lookup']);
                $(i).data('presearch', i.options['table.presearch']);
                $(i).data('postsearch', i.options['table.postsearch']);
                $(i).data('postaddsearch', i.options['table.postaddsearch']);
                $(i).data('allowadd', i.options['table.allowadd']);
                $(i).data('addclass', i.options['table.addbutton.class']);
                $(i).data('allowdelete', i.options['table.allowdelete']);

                // Lets parse and clean up the field options
                var fieldsH = {}
                $.each(i.options, function(k) {
                    if (k.match(/^table\.field\.\d+/)) {
                        var d = k.split('.');
                        if (!fieldsH[d[2]]) { fieldsH[d[2]] = {}; }

                        if (d.length > 5) {
                            if (!fieldsH[d[2]][d[3]]) { fieldsH[d[2]][d[3]] = {}; }
                            if (!fieldsH[d[2]][d[3]][d[4]]) { fieldsH[d[2]][d[3]][d[4]] = {}; }

                            var res = fieldsH[d[2]][d[3]];
                            res[d[4]][d[5]] = i.options[k];
                        } else if (d.length == 5) {
                            if (!fieldsH[d[2]][d[3]]) { fieldsH[d[2]][d[3]] = {}; }
                            var res = fieldsH[d[2]][d[3]];
                            res[d[4]] = i.options[k];
                        } else {
                            var res = i.options[k];
                        }
                        fieldsH[d[2]][d[3]] = res;
                    }
                });
                var fields = [];
                $.each(Object.keys(fieldsH).sort(function(a, b) { return a - b; }), function(k) {
                    if (fieldsH[k]['choice']) {
                        var choices = [];
                        $.each(Object.keys(fieldsH[k]['choice']).sort(function(a, b) { return a - b; }), function(x) {
                            choices.push(fieldsH[k]['choice'][x]);
                        });
                        fieldsH[k]['choice'] = choices;
                    }
                    fields.push(fieldsH[k]);
                });
                $(i).data('fields', fields);


                i.on("rendered", function() {
                    var table = $('table', this.$el);
                    console.log("got rendered!");

                    $('tr', this.$el).each(function() {
                        $(this).decorateRow(i);
                    });
                });

                mvc.Components.get(i.managerid).on("search:done", function() {
                    console.log('got search:done event');
                    // Set up the 'add' button(s)
                    if ($(i).data('allowadd') == 'true' && $(i).data('addclass')) {
                        var addbtn = $('.' + $(i).data('addclass'));

                        addbtn.addClass('btn');

                        addbtn.off('click').on('click', function(evt) {
                            var table = $('table', i.$el);
                            var data = $.extend({}, $(this).data());

                            // Remove 'uncooked' data items
                            for (var k in data) {
                                if (data[k].match(/^\$.*\$$/) || data[k] == '*') {
                                    delete data[k];
                                }
                            }

                            // Add a row for data input
                            var row = $('<tr>')
                            .addClass('add');

                            if ($('th', table).hasClass('row-number')) {
                                row.append($('<td>').addClass('row-number'));
                            }

                            $.each(_($(i).data('fields')).pluck('fieldname'), function(idx, f) {
                                var td = $('<td>')
                                .addClass('string')
                                .attr('data-cell-index', idx)
                                .data('fieldname', f);

                                if (data[f.toLowerCase()]) {
                                    td.data('original', data[f.toLowerCase()])
                                      .data('readonly', 'true')
                                      .text(data[f.toLowerCase()]);
                                } else if ($(i).data('fields')[idx]['readonly'] == 'always') {
                                    td.data('readonly', 'true');
                                } else {
                                    td.addClass('add');
                                }

                                row.append(td);
                            });

                            table.prepend(row);
                            row.decorateRow(i);

                            if ($('td.buttons', row).length == 0) {
                                row.append($('<td>').addClass('buttons'));
                            }
                            $('button.delete', row).off('click')
                                .on('click', function(evt) {
                                    row.detach()
                                });

                            var button = $('<button>')
                            .attr('type', 'button')
                            .addClass('btn btn-default add')
                            .append($('<i>')
                                .addClass('icon-check')
                            )
                            .on('click', function(evt) {
                                var cell = $(this);
                                var row = cell.closest("tr").children();
                                var table = cell.closest("table");

                                var rowData = row.getRowData();
                                var q = $(i).getBaseSearch(rowData);

                                q += ' | append [| stats count'
                                $.each(rowData, function(k, v) {
                                    var newvalue = (v['current'] ? v['current'] : v['original']);

                                    q += ' | eval ' + v['fieldname'] + '="' + newvalue + '"';
                                });
                                q += $(i).getPostAddSearch(rowData);
                                q += ' | fields - count]';
                                q += $(i).getOutputSearch(rowData);

                                var data = table.runSearch(q)
                                .on('search:done', function() {
                                    // We were adding a row, so refresh the search to get the updates
                                    i.visualization.manager.startSearch('refresh');
                                }.bind(cell))
                                .data('results', {count: 0,output_mode: 'json'});
                            });
                            $('td.buttons', row).append(button);


                            if (!table.is(':visible')) {
                                if ($('thead>tr', table).length == 0) {
                                    var header = $('<tr>');

                                    $.each(_($(i).data('fields')).map(function(x) {
                                            return (x['label']? x['label']: x['fieldname']); })
                                     , function(i, f) {
                                        var th = $('<th>')
                                        .text(f);

                                        header.append(th);
                                    });
                                    header.append($('<th>'));

                                    $('thead', table).append(header);
                                }
                                table.parent().parent().children().show();
                                $('.msg', table.parent().parent()).hide();
                            }
                        });

                    }
                });
            }
        }

        return this;

    }($));
});
