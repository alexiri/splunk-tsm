/*
 * Visualization source
 */
define([
            'jquery',
            'underscore',
            'splunkjs/mvc',
            'splunkjs/mvc/searchmanager',
            'api/SplunkVisualizationBase',
            'api/SplunkVisualizationUtils',
            'jquery-ui/jquery-ui.js',
            'jquery-ui/jquery-ui.css',
            'jquery.appendgrid',
            'jquery-validation',
            './contrib/jquery-color/jquery.color-2.1.2.min',
            'visualization_source.css'
            // Add required assets to this list
        ],
        function(
            $,
            _,
            mvc,
            SearchManager,
            SplunkVisualizationBase,
            vizUtils
        ) {

    var DIV_PADDING = 30;

    // Extend from SplunkVisualizationBase
    return SplunkVisualizationBase.extend({

        _cleanInput: function(string) {
            return vizUtils.escapeHtml(string).replace(/[\|\[\]]+/g, '');
        },

        _blinkCell: function(cell, color) {
            cell.animate({ backgroundColor: color  }, 'fast');
            cell.animate({ backgroundColor: 'white'}, 'fast');
        },

        _getConfigItem: function(config, item) {
            var i = config[this.getPropertyNamespaceInfo().propertyNamespace + item];

            if (item == 'allowAdd' || item == 'allowDelete' || item == 'rowNumbers') {
                i = vizUtils.normalizeBoolean(i);
            } else if (item == 'cellConfig') {
                try {
                    i = JSON.parse(i);
                } catch (err) {
                    throw new SplunkVisualizationBase.VisualizationError(
                        'Cell configuration is not a valid JSON string: ' + vizUtils.escapeHtml(err.message)
                    );
                }
            }

            return i;
        },

        _cancelChange: function(evt, rowIndex) {
            this._blinkCell($(evt.target), 'red');

            evt.target.value = (typeof $(evt.target).data('original') === 'undefined')? '' : $(evt.target).data('original');
            return false;
        },

        _replaceVars: function(str, rowdata) {
            return str.replace(/#([^#]+)#/g, function(m, c) {
                var d = _(rowdata).findWhere({fieldname: c}).original;
                return (d != '*' ? d : '');
            });
        },

        _getBaseSearch: function(rowdata) {
            var lookup        = this._getConfigItem(this._config, 'lookup');
            var presearch     = this._getConfigItem(this._config, 'presearch');

            var q = '| inputlookup ' + lookup;
            if (presearch) {
                q += ' | ' + this._replaceVars(presearch, rowdata);
            }
            q += ' | eval zomgItsOurRow=if(';

            var conditions = _(rowdata).map(function(f) {
                if (f.original) {
                    return f.fieldname + '=="' + f.original + '"';
                } else {
                    return '(' + f.fieldname + '=="" OR isnull(' + f.fieldname + '))';
                }
            });
            q += conditions.join(' AND ') + ',"1","0")';

            return q;
        },

        _getOutputSearch: function(rowdata) {
            var lookup        = this._getConfigItem(this._config, 'lookup');
            var postsearch    = this._getConfigItem(this._config, 'postsearch');

            var q = ' | fields - zomgItsOurRow';
            if (postsearch) {
                q += ' | ' + this._replaceVars(postsearch, rowdata);
            }
            q += ' | outputlookup ' + lookup;

            return q;
        },

        _getPostAddSearch: function(rowdata) {
            var postaddsearch = this._getConfigItem(this._config, 'postaddsearch');

            if (postaddsearch) {
                return ' | ' + this._replaceVars(postaddsearch, rowdata);
            }
            return '';
        },

        _runSearch: function(query, dataHandler, errorHandler) {
            var qhash = _.reduce(query, function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a;}, 0);

            console.log('search:', query);
            var search = new SearchManager({
                id: 'search-' + qhash,
                search: query,
                preview: false
            });

            this.listenTo(search, 'all', function(e, data) {
                if (e.substring(0, 'search:'.length) === 'search:') {
                    // console.log('search event', e, data.content.label);
                    // console.log(data.content.label,
                    //     'events', data.content.eventCount,
                    //     'isDone', data.content.isDone,
                    //     'isFailed', data.content.isFailed,
                    //     'isFinalized', data.content.isFinalized,
                    //     'isPaused', data.content.isPaused
                    // );
                    if (data.content.messages.length > 0) {
                        console.info('Search returned messages');
                        _(data.content.messages).each(function(e) {
                            if (e.type == 'WARN') {
                                console.warn(e.text);
                            } else if (e.type == 'INFO') {
                                console.info(e.text);
                            } else if (e.type == 'DEBUG') {
                                console.debug(e.text);
                            } else {
                                console.error(e.text);
                            }
                        });
                    }
                    if (data.content.isFailed) {
                        console.error('Something went wrong');
                        errorHandler(e, data);
                    }
                }
            });

            search.data('results', {count:10000}).on('data', function(e) {
                // console.log('data!', e);
                // console.log(e.data().fields);
                dataHandler(e);
            });

            return search;
        },

        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            this.$el = $(this.el);

            this.$el.append('<form class="appendGrid"><table id="tblAppendGrid"></table></form>');
        },

        setupView: function () {
            // Let the view adapt its height automatically
            this.$el.parent().parent().height('auto');

            var cellConfig     = this._getConfigItem(this._config, 'cellConfig');
            var allowAdd       = this._getConfigItem(this._config, 'allowAdd');
            var addButtonClass = this._getConfigItem(this._config, 'addButtonClass');

            if(allowAdd && addButtonClass) {
                $('.' + addButtonClass).attr('disabled', true);

                var disableButtons = function() {
                    $('.' + addButtonClass).each(function() {
                        // If one of the button's data items isn't filled in, disable it
                        this.disabled = _.some($(this).data(), function(v) { return v === '' || v === '*' || v.toString().match(/^\$.*\$$/); });
                    });
                };
                disableButtons();

                var defaultTokenModel = mvc.Components.get('default');
                this.listenTo(defaultTokenModel, 'change', disableButtons);

                var that = this;
                $('.' + addButtonClass).off('click').on('click', function(evt) {
                    var data = $.extend({}, $(this).data());

                    // Remove 'uncooked' data items
                    data = _(data).omit(function(v, k, o) {
                        return v.toString().match(/^\$.*\$$/) || v == '*';
                    });

                    var newrow = _(cellConfig).map(function(v, k) {
                        var d = _(data).find(function(value, key) {
                            return v.fieldname.toLowerCase() === key.toLowerCase();
                        });
                        return (v.readonly === 'true' && v.required === 'true' && typeof d === "undefined") ? null : that._cleanInput(d);
                    });
                    if (_(newrow).contains(null)) {
                        console.error("can't add row, I'm missing a readonly value!");
                        return false;
                    }

                    var rowdata = _.map(newrow, function(f, i) {
                        var oldValue = f;
                        var newValue = f;

                        if ('datepicker' in cellConfig[i]) {
                            if (oldValue !== "") { oldValue = (new Date(oldValue)).getTime() / 1000; }
                            if (newValue !== "") { newValue = (new Date(newValue)).getTime() / 1000; }
                        }

                        return {
                            'fieldname': cellConfig[i].fieldname,
                            'original' : oldValue,
                            'current'  : newValue,
                        };
                    });

                    var q = that._getBaseSearch(rowdata);
                    q += ' | append [| stats count';
                    _.each(newrow, function(o, i) {
                        var newvalue = (typeof o === 'undefined') ? '': o;
                        q += ' | eval ' + cellConfig[i].fieldname + '="' + newvalue + '"';
                    });
                    q += that._getPostAddSearch(rowdata);
                    q += ' | fields - count]';
                    q += that._getOutputSearch(rowdata);

                    that._runSearch(q, function(results) {
                        if (! $('#tblAppendGrid', that.el).data('appendGrid')) {
                            location.reload();
                        } else {
                            $('#tblAppendGrid', that.el).appendGrid('insertRow', [newrow], 0);
                        }
                    }, function(e, data) {});

                });
            }
        },

        // Optionally implement to format data returned from search.
        // The returned object will be passed to updateView as 'data'
        formatData: function(data) {
            // Check for an empty data object
            if (data.rows.length < 1) {
                return false;
            }

            var cellConfig    = this._getConfigItem(this._config, 'cellConfig');

            // Format columns
            var columns = _(data.fields).map(function(f, i) {
                var type = 'text';
                var options = {};
                var uiOptions = {};
                var props = {};
                var css = cellConfig[i].css;
                var ctrlClass = '';
                var attrs = {
                    'data-fieldname': cellConfig[i].fieldname,
                };

                if ('dropdown' in cellConfig[i]) {
                    type = 'select';
                    options = cellConfig[i].dropdown;
                } else if ('datepicker' in cellConfig[i]) {
                    type = 'ui-datepicker';
                    $.extend(uiOptions, {
                        dateFormat: 'yy-mm-dd',
                        changeMonth: true,
                        changeYear: true,
                        firstDay: 1,
                        yearRange: "-10:+10",
                        autoSize: true,
                        buttonImageOnly: true,
                    });
                    ctrlClass += 'dateISO';

                    if ('min' in cellConfig[i].datepicker) { uiOptions.minDate = cellConfig[i].datepicker.min; }
                    if ('max' in cellConfig[i].datepicker) { uiOptions.maxDate = cellConfig[i].datepicker.max; }
                } else if ('numeric' in cellConfig[i]) {
                    type = 'number';
                    if ('min'  in cellConfig[i].numeric) { attrs.min  = cellConfig[i].numeric.min;  }
                    if ('max'  in cellConfig[i].numeric) { attrs.max  = cellConfig[i].numeric.max;  }
                    if ('step' in cellConfig[i].numeric) { attrs.step = cellConfig[i].numeric.step; }
                }

                if (cellConfig[i].readonly === true) { attrs.readonly = 'true'; }
                if (cellConfig[i].required === true) { attrs.required = 'true'; }

                that = this;
                return {
                    name: i,
                    display: f.name,
                    type: type,
                    ctrlAttr: attrs,
                    ctrlOptions: options,
                    uiOption: uiOptions,
                    ctrlProps: props,
                    ctrlClass: ctrlClass,
                    ctrlCss: css,
                    onChange: function (evt, rowIndex) {
                        var config = _(cellConfig).findWhere({'fieldname': $(evt.target).data('fieldname')});
                        if (config.readonly === true) {
                            return that._cancelChange(evt, rowIndex);
                        }

                        // Sanitize inputs right away
                        evt.target.value = that._cleanInput(evt.target.value);

                        //console.log('onChange', rowIndex, evt);
                        //console.log('field ' + $(evt.target).data('fieldname') + ' changed', '>' + $(evt.target).data('original') + '< ==> >' + evt.target.value + '<');

                        if ($(evt.target).data('original') == evt.target.value) {
                            //console.log('No change, ignoring');
                            return true;
                        }

                        if (!$(evt.target).valid()) {
                            return that._cancelChange(evt, rowIndex);
                        }

                        // Build the row data dictionary
                        var rowClass = '#' + $(evt.target).parents('tr')[0].id;
                        var inputs = $(rowClass + '>td>input,' + rowClass + '>td>select');
                        var rowdata = _($(this.caller).appendGrid('getRowValue', rowIndex)).map(function(f, i) {
                            var oldValue = $(inputs[i]).data('original');
                            var newValue = f;

                            if ('datepicker' in cellConfig[i]) {
                                if (oldValue !== '') { oldValue = (new Date(oldValue)).getTime() / 1000; }
                                if (newValue !== '') { newValue = (new Date(newValue)).getTime() / 1000; }
                            }

                            return {
                                'fieldname': cellConfig[i].fieldname,
                                'original' : oldValue,
                                'current'  : newValue,
                            };
                        });

                        var newValue = evt.target.value;
                        if ('datepicker' in config && newValue !== '') {
                            newValue = (new Date(newValue)).getTime() / 1000;
                        }

                        // Build the search
                        var q = that._getBaseSearch(rowdata);
                        q += ' | eval ' + $(evt.target).data('fieldname') + '=if(zomgItsOurRow=="1", ';
                        q += (newValue) ? '"' + newValue + '"' : 'null';
                        q += ', ' + $(evt.target).data('fieldname') + ')';
                        q += that._getOutputSearch(rowdata);

                        that._runSearch(q, function(results) {
                            that._blinkCell($(evt.target), 'green');

                            // Set new defaultValue
                            $(evt.target).data('original', evt.target.value);

                            // Check to make sure this field wasn't a min/max for another
                            if('datepicker' in config) {
                                var dependantFields = _.filter(cellConfig, function(o) {
                                    return 'datepicker' in o && (
                                        ('min' in o.datepicker && o.datepicker.min == config.fieldname) ||
                                        ('max' in o.datepicker && o.datepicker.max == config.fieldname)
                                    ); });

                                _.each(dependantFields, function(o) {
                                    var r = _.indexOf(cellConfig, o);
                                    if ('min' in o.datepicker && o.datepicker.min == config.fieldname) {
                                        $(inputs[r]).datepicker('option', 'minDate', evt.target.value);
                                    }
                                    if ('max' in o.datepicker && o.datepicker.max == config.fieldname) {
                                        $(inputs[r]).datepicker('option', 'maxDate', evt.target.value);
                                    }
                                });
                            }
                        }, function(e, data) {
                            return that._cancelChange(evt, rowIndex);
                        });



                    }
                };
            });
            //console.log('columns', columns);

            // Format data
            var rows = _(data.rows).map(function(f, i) {
                return _(f).map(function(g, j) {
                    if (g && cellConfig[j].datepicker) {
                        return new Date(g*1000).strftime('%Y-%m-%d');
                    }

                    return g;
                });
            });
            //console.log('rows', rows);

            return {columns: columns, rows: rows};
        },

        // Implement updateView to render a visualization.
        //  'data' will be the data object returned from formatData or from the search
        //  'config' will be the configuration property object
        updateView: function(data, config) {
            // Return if no data
            if (!data) {
                $('table.tblAppendGrid', this.$el).empty();
                return;
            }

            // Get config
            var lookup         = this._getConfigItem(config, 'lookup');
            var presearch      = this._getConfigItem(config, 'presearch');
            var postsearch     = this._getConfigItem(config, 'postsearch');
            var postaddsearch  = this._getConfigItem(config, 'postaddsearch');
            var cellConfig     = this._getConfigItem(config, 'cellConfig');
            var rowNumbers     = this._getConfigItem(config, 'rowNumbers');
            var allowAdd       = this._getConfigItem(config, 'allowAdd');
            var allowDelete    = this._getConfigItem(config, 'allowDelete');
            var addButtonClass = this._getConfigItem(config, 'addButtonClass');

            // Check config
            if (lookup === '') {
                throw new SplunkVisualizationBase.VisualizationError('Must specify a lookup table');
            }

            that = this;
            $('#tblAppendGrid').appendGrid('init', {
                hideButtons: {
                    append: true,
                    remove: !allowDelete,
                    insert: true,
                    removeLast: true,
                    moveUp: true,
                    moveDown: true
                },
                hideRowNumColumn: !rowNumbers,
                autoColumnWidth: false,
                columns: data.columns,
                initData: data.rows,
                dataLoaded: function (caller, records) {
                    that.invalidateReflow();
                },
                rowDataLoaded: function (caller, record, rowIndex, uniqueIndex) {
                    var rowClass = '#' + this.idPrefix + '_Row_' + uniqueIndex;
                    _($(rowClass + '>td>input,' + rowClass + '>td>select')).each(function(f, i) {
                        $(f).attr('data-original', record[i]);
                        if('datepicker' in cellConfig[i]) {
                            if('min' in cellConfig[i].datepicker && _(cellConfig).findWhere({'fieldname': cellConfig[i].datepicker.min})) {
                                var r = _.indexOf(cellConfig, _(cellConfig).findWhere({'fieldname': cellConfig[i].datepicker.min}));
                                $(f).datepicker('option', 'minDate', record[r]);
                            }
                            if('max' in cellConfig[i].datepicker && _(cellConfig).findWhere({'fieldname': cellConfig[i].datepicker.max})) {
                                var r = _.indexOf(cellConfig, _(cellConfig).findWhere({'fieldname': cellConfig[i].datepicker.max}));
                                $(f).datepicker('option', 'maxDate', record[r]);
                            }
                        }
                    });
                },
                beforeRowRemove: function (caller, rowIndex) {
                    var msg = "Are you sure you want to delete this item?\nThis action is not reversible.";
                    if (!confirm(msg)) {
                        return false;
                    }

                    var cellConfig = that._getConfigItem(that._config, 'cellConfig');
                    var rowdata = _($(caller).appendGrid('getRowValue', rowIndex)).map(function(f, i) {
                        var oldValue = f;
                        var newValue = f;

                        if ('datepicker' in cellConfig[i]) {
                            if (oldValue !== "") { oldValue = (new Date(oldValue)).getTime() / 1000; }
                            if (newValue !== "") { newValue = (new Date(newValue)).getTime() / 1000; }
                        }

                        return {
                            'fieldname': cellConfig[i].fieldname,
                            'original' : oldValue,
                            'current'  : newValue,
                        };
                    });

                    var q = that._getBaseSearch(rowdata);
                    q += ' | search NOT zomgItsOurRow=1';
                    q += that._getOutputSearch();

                    that._runSearch(q, function(results) {
                        $(caller).appendGrid('removeRow', rowIndex);
                        return true;
                    }, function(e, data) { return false; });

                    return false;
                },
                afterRowInserted: function (caller, parentRowIndex, addedRowIndex) {
                    // Call the rowDataLoaded callback when you insert rows as well
                    _(addedRowIndex).each(function(rowIndex) {
                        var uniqueIndex = $(caller).appendGrid('getUniqueIndex', rowIndex);
                        var record = $(caller).appendGrid('getRowValue', rowIndex);
                        $(caller).data('appendGrid').rowDataLoaded(caller, record, rowIndex, uniqueIndex);
                    });

                },
            });

            $.validator.addClassRules('dateISO', {
                dateISO: true
            });

            this._validator = $('form', this.$el).validate({
                errorLabelContainer: '#ulError',
                wrapper: 'li',
            });

            this.invalidateReflow();
        },

        // Search data params
        getInitialDataParams: function() {
            return ({
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            });
        },

    });
});
