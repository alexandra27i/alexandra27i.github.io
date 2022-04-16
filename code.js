//region init
//----------------------------------------------------------------------------------------------------------------------

let d3surface;
let renderer;

let numStipples = 100;
let stippleSizeMin = 2;
let stippleSizeMax = 20;
let stipples;
let lastScalingFactor;
let intensities;
let intensitiesSize;
let stipplingReady = false;

function init() {
    d3surface = document.getElementById('d3surface');
    renderer = new Renderer(d3surface);

    lastScalingFactor = getScalingFactor();

    document.getElementById('iUploadImage').addEventListener('change', processImage);
    document.getElementById('iDotSize').addEventListener('input', dotsizeChanged);
    window.addEventListener('resize', windowResized);

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

//called on image upload
//converts image to intensities and initializes stippling
function processImage(fileEvent) {
    if(!fileEvent.target.files[0]) return;

    let ca = document.createElement("canvas");
    let co = ca.getContext("2d");

    let reader = new FileReader();
    reader.onload = function(readerEvent) {
        let img = new Image();
        img.onload = function() {
            ca.width = img.width;
            ca.height = img.height;
            co.drawImage(img, 0, 0);

            let subpixels = co.getImageData(0, 0, ca.width, ca.height).data;

            //grayscales
            stipplingReady = false;
            intensities = new Array(subpixels.length/4);
            for(let i = 0; i < subpixels.length; i+=4) {
                let avg = (subpixels[i]+subpixels[i+1]+subpixels[i+2])/3;
                intensities[i/4] = avg;
            }
            intensitiesSize = [img.width, img.height];
            initStipples();
            stipplingReady = true;
        }
        img.src = readerEvent.target.result;
    }
    reader.readAsDataURL(fileEvent.target.files[0]);
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

let threshold = 0.4;
function iterateStepStipples() {
    if(!stipplingReady) return;
    d3surface.width = d3surface.clientWidth;
    d3surface.height = d3surface.clientHeight;

    //create voronoi
    let points = Array(numStipples)
        .fill()
        .map((_, i) => ({
            x: (stipples[i*3]*0.5+0.5)*d3surface.width,
            y: (stipples[i*3+1]*0.5+0.5)*d3surface.height,
            intensity: 0, //todo: rename?
            weightedSumX: 0,
            weightedSumY: 0,
            radius: stipples[i*3+2]

        }));
    let delaunay = d3.Delaunay.from(
        points,
        (d) => d.x,
        (d) => d.y
    );
    let voronoi = delaunay.voronoi([0, 0, d3surface.width, d3surface.height]);

    //get intensities for each voronoi cell
    let cellStippleIndex = 0;
    for(let x = 0; x < d3surface.width; x++) {
        for(let y = 0; y < d3surface.height; y++) {
            cellStippleIndex = delaunay.find(x, y, cellStippleIndex);
            let cellStipple = points[cellStippleIndex];

            let _x = x/d3surface.width*intensitiesSize[0];
            let _y = y/d3surface.height*intensitiesSize[1];
            let _max = intensitiesSize[0]*intensitiesSize[1]-1;
            let _intensityPos = Math.max(0, Math.min(Math.trunc(_x*intensitiesSize[1] + _y), _max));

            let intensityAtPos = 255.0 - intensities[_intensityPos];
            cellStipple.intensity += intensityAtPos;
            cellStipple.weightedSumX += x*intensityAtPos;
            cellStipple.weightedSumY += y*intensityAtPos;
        }
    }

    //delete, split, move
    let splits = [];
    let moved = [];
    let deleted = [];
    for(let i = 0; i < points.length; i++) {
        let polygon = voronoi.cellPolygon(i);
        let cellStipple = points[i];

        //average intensity of stipple over its area
        let area = Math.abs(d3.polygonArea(polygon)) || 1; //cant be 0
        let avg_intensity = cellStipple.intensity / area;

        //map intensity to a radius
        let radius = (avg_intensity / 255.0) * (stippleSizeMax - stippleSizeMin) + stippleSizeMin;

        //calculate thresholds
        let stippleArea = Math.PI * radius * radius;
        let threshold_delete = (1.0 - threshold / 2.0) * stippleArea;
        let threshold_split = (1.0 + threshold / 2.0) * stippleArea;

        if (cellStipple.intensity < threshold_delete*255.0) {
            //delete (by not doing anything with this)
            deleted.push(cellStipple);
        } else if (cellStipple.intensity > threshold_split*255.0) {
            //split
            let cellCenter = d3.polygonCentroid(polygon);

            let dist = Math.sqrt(area / Math.PI) / 2.0; //act like poly is a circle and get half the radius
            let deltaX = cellCenter[0] - cellStipple.x;
            let deltaY = cellCenter[1] - cellStipple.y;
            let vectorLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            deltaX /= vectorLength;
            deltaY /= vectorLength;

            let splitA = [];
            splitA.x = cellCenter[0] + dist * deltaX;
            splitA.y = cellCenter[1] + dist * deltaY;
            splitA.radius = radius;
            let splitB = [];
            splitB.x = cellCenter[0] - dist * deltaX;
            splitB.y = cellCenter[1] - dist * deltaY;
            splitB.radius = radius;

            splits.push(splitA);
            splits.push(splitB);
        } else {
            //move
            cellStipple.x = cellStipple.weightedSumX / cellStipple.intensity;
            cellStipple.y = cellStipple.weightedSumY / cellStipple.intensity;
            cellStipple.radius = radius;
            moved.push(cellStipple);
        }
    }

    console.log("deleted: " + deleted.length);
    console.log("splits: " + splits.length);
    console.log("moved: " + moved.length);


    //adjust threshold and rebuild points
    threshold += 0.01;
    points.length = moved.length + splits.length;
    for(let i = 0; i < moved.length; i++) points[i] = moved[i];
    for(let i = 0; i < splits.length; i++) points[i + moved.length] = splits[i];

    //rebuild stipples from it todo: think about something else, this is actually horrible
    numStipples = points.length;
    stipples = new Array(numStipples * 3); //x,y,size for each stipple
    for (let i = 0; i < points.length; i++) {
        stipples[i*3] = ((points[i].x / d3surface.width) - 0.5) * 2.0;
        stipples[i*3+1] = ((points[i].y / d3surface.height) - 0.5) * 2.0;
        stipples[i*3+2] = points[i].radius;
    }

    //display them
    redrawStipples();
}

function redrawStipples() {
    renderer.drawDots(stipples, true);
    renderer.drawVoronoi(stipples, false);
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
class Renderer { //todo: stippling data object as a class, to streamline any buffer indices and so on
    #canvas;
    #gl;
    #shaderDots;
    #shaderLines;
    #vboDots;
    #vboLines;

    clear = [0.5, 0.5, 0.5];
    color = [0.2, 0.2, 0.2];

    constructor(canvas) {
        this.#canvas = canvas;
        this.#gl = canvas.getContext(
            'webgl',
            {antialias: false, alpha: true, preserveDrawingBuffer: true}
        );
        this.#init_shader();
        this.#init_buffers();
    }

    drawDots(data, clearBefore = true) {
        this.#fixCanvas();
        this.#gl.useProgram(this.#shaderDots);

        //buffers
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#vboDots);
        this.#gl.bufferData(this.#gl.ARRAY_BUFFER, new Float32Array(data), this.#gl.STATIC_DRAW);
        let aPos = this.#gl.getAttribLocation(this.#shaderDots, "aPos");
        this.#gl.vertexAttribPointer(aPos, 2, this.#gl.FLOAT, false, 12, 0);
        this.#gl.enableVertexAttribArray(aPos);
        let aSize = this.#gl.getAttribLocation(this.#shaderDots, "aSize");
        this.#gl.vertexAttribPointer(aSize, 1, this.#gl.FLOAT, false, 12, 8);
        this.#gl.enableVertexAttribArray(aSize);

        //uniforms
        this.#gl.uniform2fv(this.#gl.getUniformLocation(this.#shaderDots,
                "screen"), [
                this.#canvas.width,
                this.#canvas.height
            ]
        );
        this.#gl.uniform3fv(this.#gl.getUniformLocation(this.#shaderDots,
            "color"), this.color);

        //draw
        this.#prepareDrawing(clearBefore);
        this.#gl.drawArrays(this.#gl.POINTS, 0, data.length/3);

        //clean finish
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);
    }

    drawVoronoi(data, clearBefore = true) { //todo: dont create voronoi here - we need it outside too
        this.#fixCanvas();
        let lines = this.#generateVoronoi(data);
        this.#gl.useProgram(this.#shaderLines);

        //buffers
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#vboLines);
        this.#gl.bufferData(this.#gl.ARRAY_BUFFER, new Float32Array(lines), this.#gl.STATIC_DRAW);
        let aPos = this.#gl.getAttribLocation(this.#shaderLines, "aPos");
        this.#gl.vertexAttribPointer(aPos, 2, this.#gl.FLOAT, false, 0, 0);
        this.#gl.enableVertexAttribArray(aPos);

        //uniforms
        this.#gl.uniform3fv(this.#gl.getUniformLocation(this.#shaderLines,
            "line_color"), this.color);

        //draw
        this.#prepareDrawing(clearBefore);
        this.#gl.drawArrays(this.#gl.LINES, 0, lines.length/2);

        //clean finish
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);
    }

    #init_shader() {
        //dots shader
        let dotvs = this.#gl.createShader(this.#gl.VERTEX_SHADER);
        this.#gl.shaderSource(dotvs, document.getElementById("dots-vs").innerHTML);
        this.#gl.compileShader(dotvs);
        let dotfs = this.#gl.createShader(this.#gl.FRAGMENT_SHADER);
        this.#gl.shaderSource(dotfs, document.getElementById("dots-fs").innerHTML);
        this.#gl.compileShader(dotfs);
        this.#shaderDots = this.#gl.createProgram();
        this.#gl.attachShader(this.#shaderDots, dotvs);
        this.#gl.attachShader(this.#shaderDots, dotfs);
        this.#gl.linkProgram(this.#shaderDots);

        //lines shader
        let linesvs = this.#gl.createShader(this.#gl.VERTEX_SHADER);
        this.#gl.shaderSource(linesvs, document.getElementById("lines-vs").innerHTML);
        this.#gl.compileShader(linesvs);
        let linesfs = this.#gl.createShader(this.#gl.FRAGMENT_SHADER);
        this.#gl.shaderSource(linesfs, document.getElementById("lines-fs").innerHTML);
        this.#gl.compileShader(linesfs);
        this.#shaderLines = this.#gl.createProgram();
        this.#gl.attachShader(this.#shaderLines, linesvs);
        this.#gl.attachShader(this.#shaderLines, linesfs);
        this.#gl.linkProgram(this.#shaderLines);
    }

    #init_buffers() {
        this.#vboDots = this.#gl.createBuffer();
        this.#vboLines = this.#gl.createBuffer();
    }

    #fixCanvas() {
        this.#canvas.width = this.#canvas.clientWidth;
        this.#canvas.height = this.#canvas.clientHeight;
    }

    #prepareDrawing(clearBefore) {
        this.#gl.enable(this.#gl.BLEND);
        this.#gl.blendFunc(this.#gl.SRC_ALPHA, this.#gl.ONE_MINUS_SRC_ALPHA);
        if(clearBefore) {
            this.#gl.clearColor(this.clear[0], this.clear[1], this.clear[2], 1.0);
            this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);
        }
        this.#gl.viewport(0,0,this.#canvas.width, this.#canvas.height);
    }

    #generateVoronoi(data) {
        let points = Array(numStipples)
            .fill()
            .map((_, i) => ({
                x: data[i*3],
                y: data[i*3+1]
            }));

        let voronoi = d3.Delaunay.from(
            points,
            (d) => d.x,
            (d) => d.y
        ).voronoi([-1, -1, 1, 1]);

        let _segments = voronoi.render();
        const segments = voronoi.render().split(/M/).slice(1);
        let lines = new Array(segments.length*4);
        for (let i = 0; i < segments.length; i++) { //p1x,p1y L p2x,p2y
            let p1p2 = segments[i].split(/L/);
            let p1 = p1p2[0].split(/,/);
            let p2 = p1p2[1].split(/,/);
            lines[i*4  ] = parseFloat(p1[0]);
            lines[i*4+1] = parseFloat(p1[1]);
            lines[i*4+2] = parseFloat(p2[0]);
            lines[i*4+3] = parseFloat(p2[1]);
        }

        return lines;
    }
}

//----------------------------------------------------------------------------------------------------------------------
//endregion
