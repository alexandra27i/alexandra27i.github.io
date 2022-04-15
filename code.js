//region init
//----------------------------------------------------------------------------------------------------------------------

let d3surface;
let renderer;

let numStipples = 1000;
let stippleSizeMin = 2;
let stippleSizeMax = 30;
let stipples;

function init() {
    d3surface = document.getElementById('d3surface');
    renderer = new Renderer(d3surface);

    document.getElementById('iUploadImage').addEventListener('change', processImage);
    document.getElementById('iDotSize').addEventListener('input', dotsizeChanged);
    window.addEventListener('resize', windowResized);

    var elements = document.getElementsByClassName("reactive_range");
    for(var element of elements) {
        element.oninput = adjustRangeVisuals;
        element.oninput();
    }

    initStipples();
    redrawStipples();
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

function dotsizeChanged() {
    scaleStipples();
    redrawStipples();
}

function windowResized() {
    if(d3surface.width !== d3surface.clientWidth || d3surface.height !== d3surface.clientHeight) {
        d3surface.width = d3surface.clientWidth;
        d3surface.height = d3surface.clientHeight;
        redrawStipples();
    }
}

//----------------------------------------------------------------------------------------------------------------------
//endregion

//region Stippling
//----------------------------------------------------------------------------------------------------------------------

function processImage() {
    if (this.files && this.files[0]) {
        var imgdata = this.files[0];

        //var img = document.getElementById("testImage");
        //img.src = URL.createObjectURL(imgdata);
    }
}

function initStipples() {
    stipples = new Array(numStipples * 3);
    const pran = d3.randomUniform(-1, 1);
    const sran = d3.randomUniform(stippleSizeMin, stippleSizeMax);
    for (let i = 0; i < numStipples*3; i+=3) {
        stipples[i] = pran();
        stipples[i+1] = pran();
        stipples[i+2] = sran();
    }
}

function redrawStipples() {
    renderer.draw(stipples);
}

let lastFactor = 0.5;
function scaleStipples() {
    let sizeFactor = document.getElementById("iDotSize").value/100.0;
    for(let i = 0; i < numStipples * 3; i+=3) {
        stipples[i+2] /= lastFactor;
        stipples[i+2] *= sizeFactor;
    }
    lastFactor = sizeFactor;
}

//render dots via WebGL
//shaders are on the main page in script tags (syntax highlighting, yey)
class Renderer {
    #shader_id_screenResolution = "screen";
    #shader_id_pos_size = "pos_size";
    #shader_id_dot_color = "dot_color";
    #shader_id_clear_color = "clear_color";

    #canvas;
    #gl;
    #shader;
    #vbo;

    clear = [1.0, 1.0, 1.0];
    dot_color = [0.2, 0.2, 0.2];

    constructor(canvas) {
        this.#canvas = canvas;
        this.#gl = canvas.getContext('webgl', {antialias: false, alpha: false})
        this.#init_shader();
        this.#init_buffers();
    }

    draw(data) {
        //ensure canvas consistency
        this.#canvas.width = this.#canvas.clientWidth;
        this.#canvas.height = this.#canvas.clientHeight;

        //prepare draw
        this.#gl.useProgram(this.#shader);
        this.#bind(data);
        this.#uniforms();

        //draw
        this.#gl.clearColor(this.clear[0], this.clear[1], this.clear[2], 1.0);
        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);
        this.#gl.viewport(0,0,this.#canvas.width, this.#canvas.height);
        this.#gl.drawArrays(this.#gl.POINTS, 0, data.length/3);

        //clean finish
        this.#unbind();
    }

    #init_shader() {
        var vertShader = this.#gl.createShader(this.#gl.VERTEX_SHADER);
        this.#gl.shaderSource(vertShader, document.getElementById("shader-vs").innerHTML);
        this.#gl.compileShader(vertShader);

        var fragShader = this.#gl.createShader(this.#gl.FRAGMENT_SHADER);
        this.#gl.shaderSource(fragShader, document.getElementById("shader-fs").innerHTML);
        this.#gl.compileShader(fragShader);

        this.#shader = this.#gl.createProgram();
        this.#gl.attachShader(this.#shader, vertShader);
        this.#gl.attachShader(this.#shader, fragShader);

        this.#gl.linkProgram(this.#shader);
    }
    #init_buffers() {
        this.#vbo = this.#gl.createBuffer();
    }
    #bind(data) {
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#vbo);
        this.#gl.bufferData(this.#gl.ARRAY_BUFFER, new Float32Array(data), this.#gl.STATIC_DRAW); //glBufferSubData?

        let coord = this.#gl.getAttribLocation(this.#shader, this.#shader_id_pos_size);
        this.#gl.vertexAttribPointer(coord, 3, this.#gl.FLOAT, false, 0, 0);
        this.#gl.enableVertexAttribArray(coord);
    }
    #unbind() {
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);
    }
    #uniforms() {
        this.#gl.uniform2fv(this.#gl.getUniformLocation(this.#shader,
            this.#shader_id_screenResolution), [
                this.#canvas.width,
                this.#canvas.height
            ]
        );
        this.#gl.uniform3fv(this.#gl.getUniformLocation(this.#shader,
            this.#shader_id_dot_color), this.dot_color);
        this.#gl.uniform3fv(this.#gl.getUniformLocation(this.#shader,
            this.#shader_id_clear_color), this.clear);
    }
}

//----------------------------------------------------------------------------------------------------------------------
//endregion
