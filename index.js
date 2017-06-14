var path = require('path');
var fs = require('fs');

var jquery = require('jquery');
var jsdom = require("jsdom");
var SCHEMA = "http://json-schema.org/draft-04/schema#";
function idToUrl(reference) {
    return `https://raw.githubusercontent.com/joelharkes/kubernetes-json-schema/master/generated/${reference}.json`;
}

jsdom.env('https://kubernetes.io/docs/resources-reference/v1.5/', function (err, window) {
    var $page = jquery(window);
    var schemas = parsePage($page);
    //console.log(schemas);
    writeSchemas(schemas);

});

/**
 * @param {Array.<Objtect>} schema
 */
function writeSchemas(schemas = []) {
    schemas.forEach(schema => {
        var file = path.resolve("generated", `${schema.name}.json`);
        var json = JSON.stringify(schema, null, 4);
        if(process.env.USE_CRLF)
            json = json.replace(/\n/g,'\r\n');
        fs.writeFile(file, json, () => { })
    })
}


function parsePage($) {
    return $('#wrapper h1, #wrapper h2, #wrapper h3')
        .filter(function () {
            return this.id.indexOf('-strong-') === -1
        })
        .map(function () {
            console.log(this.id);
            var $part = $(this);
            var schema = {
                "$schema": SCHEMA,
                id: idToUrl($part.attr('id')),
                name: $part.attr('id'),
                description: $part.nextAll('p:first').text(),
                type: "object",
                properties: {},
            }
            var $table =  $part.nextAll('table:first');
            if($table.find('th').first().text().indexOf('Group') !== -1) 
                $table = $table.nextAll('table:first');//if group table, go to next.
            var $props = $table.find('tr').slice(1);
            $props.each(function () {
                if (this.children.length != 2) {
                    console.log('unexpected table')
                    return;
                }

                var propName = this.children[0].childNodes[0].textContent.trim();
                $field = $(this.children[0]);
                if ($field.find('em > a').length === 0) {
                    //Its a simple value
                    var data = {
                        type: $field.find('em').text().split(' '),
                        description: this.children[1].textContent
                    };
                    schema.properties[propName] = data;
                } else {
                    //em contains a, its a references
                    var reference = idToUrl($field.find('em > a').attr('href').substring(1));
                    if ($field.find('em').text().indexOf(' array') === -1) {
                        schema.properties[propName] = { "$ref": reference };
                    } else { //if it is an array of items
                        schema.properties[propName] = { "type": "array", "items": { "$ref": reference } };
                    }
                }

            });
            return schema;
        }).toArray();
}
