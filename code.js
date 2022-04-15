//region init
//----------------------------------------------------------------------------------------------------------------------

let d3surface;
let renderer;

let numStipples = 1000;
let stippleSizeMin = 2;
let stippleSizeMax = 30;
let stipples;
let lastScalingFactor;

function init() {
    d3surface = document.getElementById('d3surface');
    //renderer = new Renderer(d3surface);

    lastScalingFactor = getScalingFactor();

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

function getScalingFactor() {
    return document.getElementById("iDotSize").value/100.0;
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
    stipples = new Array(numStipples * 3); //x,y,size for each stipple
    const pran = d3.randomUniform(-1, 1);
    const sran = d3.randomUniform(stippleSizeMin, stippleSizeMax);
    for (let i = 0; i < numStipples*3; i+=3) {
        stipples[i] = pran();
        stipples[i+1] = pran();
        stipples[i+2] = sran();
    }


}

function iterateStepStipples() {

}

function redrawStipples() {
    //renderer.draw(stipples);

    let context = d3surface.getContext("2d");
    d3surface.width = d3surface.clientWidth;
    d3surface.height = d3surface.clientHeight;
    const data = Array(100)
        .fill()
        .map((_, i) => ({ x: (i * d3surface.width) / 100, y: Math.random() * d3surface.height }));

    const voronoi = d3.Delaunay.from(
        data,
        (d) => d.x,
        (d) => d.y
    ).voronoi([0, 0, d3surface.width, d3surface.height]);

    context.clearRect(0, 0, d3surface.width, d3surface.height);
    context.fillStyle = "black";
    context.beginPath();
    voronoi.delaunay.renderPoints(context, 1);
    context.fill();

    context.lineWidth = 1.5;

    const segments = voronoi.render().split(/M/).slice(1);
    let i = 0;
    for (const segment of segments) {
        context.beginPath();
        context.strokeStyle = "black";
        context.stroke(new Path2D("M" + segment));
    }
}

function scaleStipples() {
    let scalingFactor = getScalingFactor();
    for(let i = 0; i < numStipples * 3; i+=3) {
        stipples[i+2] /= lastScalingFactor;
        stipples[i+2] *= scalingFactor;
    }
    lastScalingFactor = scalingFactor;
}

//render dots via WebGL
//shaders are on the main page in script tags (syntax highlighting, yey)
class Renderer {
    #shader_id_screenResolution = "screen";
    #shader_id_pos_size = "pos_size";
    #shader_id_dot_color = "dot_color";

    #canvas;
    #gl;
    #shader;
    #vbo;

    clear = [1.0, 1.0, 1.0];
    dot_color = [0.2, 0.2, 0.2];

    constructor(canvas) {
        this.#canvas = canvas;
        this.#gl = canvas.getContext('webgl', {antialias: false, alpha: true})
        this.#init_shader();
        this.#init_buffers();
    }

    draw(data) {
        //ensure canvas consistency
        this.#canvas.width = this.#canvas.clientWidth;
        this.#canvas.height = this.#canvas.clientHeight;

        //init
        this.#gl.useProgram(this.#shader);
        this.#bind(data);
        this.#uniforms();

        //prepare
        this.#gl.enable(this.#gl.BLEND);
        this.#gl.blendFunc(this.#gl.SRC_ALPHA, this.#gl.ONE_MINUS_SRC_ALPHA);
        this.#gl.clearColor(this.clear[0], this.clear[1], this.clear[2], 1.0);
        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);
        this.#gl.viewport(0,0,this.#canvas.width, this.#canvas.height);

        //draw
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
    }
}

//----------------------------------------------------------------------------------------------------------------------
//endregion
