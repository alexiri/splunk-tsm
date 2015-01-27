// Editable Table
// this displays information as a gantt chart

define(function(require, exports, module) {

    var _ = require('underscore');
    var TableElement = require("splunkjs/mvc/simplexml/element/table");
    var DashboardElement = require('splunkjs/mvc/simplexml/element/base');

    require("css!./gantt.css");

    var margin = {top: 10, right: 10, bottom: 10, left: 10};

    var EditTable = TableElement.extend({

        className: "custom-edittable",

        options: {
            managerid: null,
        },

        output_mode: "json",

        initialize: function() {
            TableVisualization.prototype.initialize.apply(this, arguments);

        },

    });

    return EditTable;
});
