//region init
//----------------------------------------------------------------------------------------------------------------------

//global vars? dunno, lets see what we need
function init() {
    document.getElementById("iUploadImage").addEventListener('change', processImage);

    var elements = document.getElementsByClassName("reactive_range");
    for(var element of elements) {
        element.oninput = adjustRangeVisuals;
        element.oninput();
    }
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

//adds color to the left and right side of the sliders thumb (visual sugar, nothing more)
function adjustRangeVisuals() {
    var value = (this.value-this.min)/(this.max-this.min)*100;
    this.style.background = 'linear-gradient(' +
        'to right,' +
        'var(--color_accent) 0%, var(--color_accent) '+value+'%, ' +
        'var(--color_background) '+value+'%, var(--color_background) 100%' +
        ')'
    ;
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
