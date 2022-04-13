//region init
//----------------------------------------------------------------------------------------------------------------------

//global vars? dunno, lets see what we need
function init() {
    document.getElementById("iUploadImage").addEventListener('change', processImage);
}

//----------------------------------------------------------------------------------------------------------------------
//endregion

//region UI
//----------------------------------------------------------------------------------------------------------------------

//reroute the button click to the actual file dialog
function acceptFile() {
    //why?
    //the normal file button is ugly, and styling it is not supported up until recently
    //it is solved that way for the sake of backward compatibility
    document.getElementById('iUploadImage').click();
}

//----------------------------------------------------------------------------------------------------------------------
//endregion

//region Stippling
//----------------------------------------------------------------------------------------------------------------------

function processImage() {
    if (this.files && this.files[0]) {
        var imgdata = this.files[0];

        var img = document.getElementById("testImage");
        img.src = URL.createObjectURL(imgdata);

        //todo: use a canvas instead and draw some dots
    }
}
//----------------------------------------------------------------------------------------------------------------------
//endregion
