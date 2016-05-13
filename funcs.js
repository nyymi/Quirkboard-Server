const path = require('path');

exports.containsNullProperty = function(target) {
    for (var member in target) {
        if (target[member] == null)
            return true;
    }

    return false;
}

exports.extractBase64FileFromObject = function(target) {
    var file_src = '';
    var file_data = target.file;

    if (file_data) {
        if (file_data.indexOf('png') > -1 || file_data.indexOf('jpg') > -1 || file_data.indexOf('jpeg') > -1) {
            file_src = target.filesrc = (target.filesrc != null) ? path.basename(target.filesrc.replace(/\\/g, '/')) : null;
            file_data = JSON.stringify(file_data).substring(file_data.indexOf('base64,') + 'base64,'.length + 1, file_data.length);
        } else {
            file_src = null;
            file_data = null;
        }
    }

    delete target.file;

    return [file_src, file_data, (file_data) ? true : false];
}
