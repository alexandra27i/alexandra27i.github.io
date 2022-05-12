//region init
//----------------------------------------------------------------------------------------------------------------------

let stippler;

/**
 * called on body onload
 */
function init() {
    stippler = new Stippler(document.getElementById('d3surface'));

    let mB = false;

    document.getElementById('iUploadImage').addEventListener('change', acceptImage);
    document.getElementById('iDotSize').addEventListener('input', dotsizeChanged);
    // document.getElementById('iMachbanding').addEventListener('input', machBandingChanged);
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

/**
 * reads an uploaded file and moves it on to processing
 * @param fileEvent
 */
function acceptImage(fileEvent) {
    if(!fileEvent.target.files[0]) return;

    let reader = new FileReader();
    reader.onload = function(readerEvent) {
        let img = new Image();
        img.onload = function() {
            processImage(img);
        }
        img.src = readerEvent.target.result;
    }
    reader.readAsDataURL(fileEvent.target.files[0]);
}

/**
 * adds color to the left and right side of the sliders thumb (visual sugar, nothing more)
 */
function adjustRangeVisuals() {
    var value = (this.value-this.min)/(this.max-this.min)*100;
    this.style.background = 'linear-gradient(' +
        'to right,' +
        'var(--color_accent) 0%, var(--color_accent) '+value+'%, ' +
        'var(--color_background) '+value+'%, var(--color_background) 100%' +
        ')'
    ;
}

/**
 * manages global scaling
 */
function dotsizeChanged() {
    let factor = document.getElementById("iDotSize").value/100.0;

    stippler.scaleAll(factor);
    stippler.draw();
}

/**
 * placeholder for any actions taken on window resize
 */
function windowResized() {

}

function machBandingChanged() {
    stippler.machBandingChanged();
}

//----------------------------------------------------------------------------------------------------------------------
//endregion

//region Stippling
//----------------------------------------------------------------------------------------------------------------------

//todo: these are just here for quick access, we might wanna make them available via UI
//      colors for the rest of the page are in the .css: :root
//      I think we should do the stippling threaded to keep the UI responsive
const STIPPLING_RANGE = [0.1, 3];
const COLOR_WEBGL_BACK = [1.0, 1.0, 1.0];
const COLOR_WEBGL_FRONT = [0.0, 0.0, 0.0];

/**
 * Converts the image to grayscale with flipped y-axis and starts the stippling algorithm
 * @param img uploaded image
 */
function processImage(img) {
    let ca = document.createElement("canvas");
    let co = ca.getContext("2d");

    ca.width = img.width;
    ca.height = img.height;
    co.drawImage(img, 0, 0);

    let subpixels = co.getImageData(0, 0, ca.width, ca.height).data;

    //grayscale
    let density = Array.from(Array(ca.width), () => new Array(ca.height));
    for(let i = 0; i < subpixels.length; i+=4) {
        let y = Math.trunc((i/4) / ca.width);
        let x = (i/4) - y * ca.width;

        density[x][ca.height-1-y] = (subpixels[i]+subpixels[i+1]+subpixels[i+2])/3; //flip y
    }
    stippler.initialize(density, STIPPLING_RANGE);
    stippler.run();
    stippler.draw();
}

/**
 * Provides the stippling algorithm.
 * use in the following order: Initialize -> Run/Step -> Draw
 */
class Stippler {
    #initialized=false;

    #renderer;
    #stippleBuffer;

    #stipples;
    #stippleRange;
    #stepThreshold;
    #stepRemainingError;
    #stippleScale;

    #density;
    #densityRange;

    #mb;
    #mbDensity;
    #mbWeight;
    #mbContourSteps;
    #mbContourMap;
    #mbGaussianSize;                // yielded good results when close to stipple

    /**
     * Stippler constructor
     * @param canvas used for the WebGL context to draw to
     */
    constructor(canvas) {
        this.#renderer = new Renderer(canvas);
    }

    /**
     * Initializes the stippling algorithm with a specified density and resets all parameters. This needs to be
     * called before running the stippling algorithm.
     * @param density 2D array of density values
     * @param stippleRange range for stipple radius: [min, max]
     * @param stipplesAtStart optional, defines the number of random stipples at the start
     */
    initialize(density, stippleRange, stipplesAtStart=100) {
        this.#stipples = new Array(stipplesAtStart);
        this.#stippleRange = stippleRange;
        this.#stippleRange.distance = stippleRange[1] - stippleRange[0];
        this.#stepThreshold = 0.4;
        this.#stepRemainingError = 1.0;
        this.#stippleScale = 1.0;

        this.#density = density;
        this.#densityRange = [0, 0];
        for(let x = 0; x < density.length; x++) {
            for(let y = 0; y < density[x].length; y++) {
                let val = density[x][y];
                if(val < this.#densityRange[0]) this.#densityRange[0] = val;
                if(val > this.#densityRange[1]) this.#densityRange[1] = val;
            }
        }
        this.#densityRange.distance = this.#densityRange[1] - this.#densityRange[0];

        const pran = d3.randomUniform(0, 1);
        for(let i = 0; i < stipplesAtStart; i++) {
            this.#stipples[i] = {
                x: pran(),
                y: pran(),
                r: this.#stippleRange[0]
            };
        }

        //#mbDensity;
        //#mbWeight;
        //#mbContourSteps;
        //#mbGaussianSize;                // yielded good results when close to stipple

        this.#mbContourSteps = 5;       // obsolete for now
        this.#mbContourMap = density;

        this.#mb = false;


        for(let x = 0; x < density.length; x++) {
            for(let y = 0; y < density[x].length; y++) {
                let val = density[x][y];

                if (val < this.#densityRange[1]/5)
                    this.#mbContourMap[x][y] = 0;
                else if (val < this.#densityRange[1]*2/5 && val >= this.#densityRange[1]/5)
                    this.#mbContourMap[x][y] = 63;
                else if (val < this.#densityRange[1]*3/5 && val >= this.#densityRange[1]*2/5)
                    this.#mbContourMap[x][y] = 127;
                else if (val < this.#densityRange[1]*4/5 && val >= this.#densityRange[1]*3/5)
                    this.#mbContourMap[x][y] = 191;
                else {
                    this.#mbContourMap[x][y] = 254;
                }
            }
        }


        this.#initialized = true;
    }

    /**
     * samples a density from the density data provided during initialize
     * @param x position in x-axis in range [0,1]
     * @param y position in y-axis in range [0,1]
     * @param invert result will be inverted
     * @returns {number|*} density at specified position
     */
    #sampleDensityAt(x, y, invert=true) {
        let densityX = Math.trunc(x * this.#density.length);
        let densityY = Math.trunc(y * this.#density[0].length);
        /*
        if (this.#mb === false) { //TODO: switch back
            return invert
                ? this.#densityRange[1] - this.#density[densityX][densityY]
                : this.#density[densityX][densityY];
        } else {
         */
            return invert
                ? this.#densityRange[1] - this.#mbContourMap[densityX][densityY]
                : this.#mbContourMap[densityX][densityY];  //TODO: switch back to mbDensity
        //}
    }

    /**
     * maps a density value to a radius according to their ranges
     * @param density density value
     * @returns {*} radius value
     */
    #densityToRadius(density) {
        return (((density + this.#densityRange[0])
            / this.#densityRange.distance)
            * this.#stippleRange.distance)
            + this.#stippleRange[0];
    }

    /**
     * calculates the thresholds for delete and split operations based on the calculated radius.
     * this assumes the max intensity on the area occupied by the stipple
     * @param radius of the stipple
     * @returns {number[]} an array: [delete threshold, split threshold]
     */
    #getDensityThreshold(radius) {
        let area = Math.PI * radius * radius;
        return [
            ((1.0 - this.#stepThreshold / 2.0) * area) * this.#densityRange.distance,
            ((1.0 + this.#stepThreshold / 2.0) * area) * this.#densityRange.distance
        ];
    }

    /**
     * executes one iteration of the stippling algorithm
     * @param updateBuffer if true, the WebGL buffer is updated after the iteration
     */
    step(updateBuffer=true) {
        if(!this.#initialized) return;

        let [width, height] = this.#renderer.getCanvasDimension(); //can be scaled for performance/quality

        //reset values and denormalize positions
        for(let i = 0; i < this.#stipples.length; i++) {
            this.#stipples[i].density = 0;
            this.#stipples[i].weightedSumX = 0;
            this.#stipples[i].weightedSumY = 0;

            this.#stipples[i].x *= width;
            this.#stipples[i].y *= height;
        }

        //create voronoi
        let delaunay = d3.Delaunay.from(
            this.#stipples,
            (d) => d.x,
            (d) => d.y
        );
        let voronoi = delaunay.voronoi([0, 0, width, height]);

        //get density value for each voronoi cell
        let cellStippleIndex = 0;
        for(let x = 0; x < width; x++) {
            for(let y = 0; y < height; y++) {
                cellStippleIndex = delaunay.find(x, y, cellStippleIndex);
                let cellStipple = this.#stipples[cellStippleIndex];

                let sampledDensity = this.#sampleDensityAt(x/width, y/height);
                cellStipple.density += sampledDensity;
                cellStipple.weightedSumX += x*sampledDensity;
                cellStipple.weightedSumY += y*sampledDensity;
            }
        }

        //delete, split, move
        let splits = [];
        let moved = [];
        let deleted = 0;
        for(let i = 0; i < this.#stipples.length; i++) {
            let polygon = voronoi.cellPolygon(i);
            let cellStipple = this.#stipples[i];

            //average intensity of stipple over its area
            let area = Math.abs(d3.polygonArea(polygon)) || 1; //cant be 0
            let avg_density = cellStipple.density / area;

            //map density to a radius
            let radius = this.#densityToRadius(avg_density);

            //calculate thresholds
            let [thDelete,thSplit] = this.#getDensityThreshold(radius);

            if (cellStipple.density < thDelete) {
                deleted++;
            } else if (cellStipple.density > thSplit) {
                //split
                let cellCenter = d3.polygonCentroid(polygon);

                let dist = Math.sqrt(area / Math.PI) / 2.0;
                let deltaX = cellCenter[0] - cellStipple.x;
                let deltaY = cellCenter[1] - cellStipple.y;
                let vectorLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                deltaX /= vectorLength;
                deltaY /= vectorLength;

                splits.push({
                    x: cellCenter[0] + dist * deltaX,
                    y: cellCenter[1] + dist * deltaY,
                    r: radius
                });
                splits.push({
                    x: cellCenter[0] - dist * deltaX,
                    y: cellCenter[1] - dist * deltaY,
                    r: radius
                });
            } else {
                //move
                cellStipple.x = cellStipple.weightedSumX / cellStipple.density;
                cellStipple.y = cellStipple.weightedSumY / cellStipple.density;
                cellStipple.r = radius;
                moved.push(cellStipple);
            }
        }

        //adjust threshold and rebuild points
        this.#stepThreshold += 0.01;
        this.#stipples.length = moved.length + splits.length;
        for(let i = 0; i < moved.length; i++) this.#stipples[i] = moved[i];
        for(let i = 0; i < splits.length; i++) this.#stipples[i + moved.length] = splits[i];

        //normalize stipple positions
        for (let i = 0; i < this.#stipples.length; i++) {
            this.#stipples[i].x /= width;
            this.#stipples[i].y /= height;
        }

        this.#stepRemainingError = (deleted + splits.length) / (moved.length + splits.length + deleted);
        if(updateBuffer) this.#updateStippleBuffer();
    }

    /**
     * Updates the buffer used for WebGL rendering, containing all the data necessary in the shaders
     */
    #updateStippleBuffer() {
        this.#stippleBuffer = new Array(this.#stipples.length * 3); //x,y,size for each stipple
        for (let i = 0; i < this.#stipples.length; i++) {
            this.#stippleBuffer[i*3  ] = ((this.#stipples[i].x - 0.5) * 2);
            this.#stippleBuffer[i*3+1] = ((this.#stipples[i].y - 0.5) * 2);
            this.#stippleBuffer[i*3+2] = this.#stipples[i].r * this.#stippleScale;
        }
    }

    /**
     * executes the stippling algorithm up to the specified remaining error
     * @param remainingError ratio of cells that are still split up or deleted in range [0, 1]
     */
    run(remainingError=0.05) {
        if(!this.#initialized) return;

        while(this.#stepRemainingError > remainingError) {
            this.step(false);
        }
        this.#updateStippleBuffer();
    }

    /**
     * adjusts the scaling factor and updates the render buffer data
     * @param factor constant scaling factor for all stipples
     */
    scaleAll(factor=1.0) {
        if(!this.#initialized) return;
        this.#stippleScale = factor;

        for (let i = 0; i < this.#stipples.length; i++) {
            this.#stippleBuffer[i*3+2] = this.#stipples[i].r * this.#stippleScale;
        }
    }

    machBandingChanged() {
        this.#mb = !this.#mb;
    }

    /**
     * draw all stipples on the canvas provided during object creation
     * @param voronoiLines if true, voronoi cells are rendered as well
     */
    draw(voronoiLines=false) {
        if(!this.#initialized) return;

        this.#renderer.drawDots(this.#stippleBuffer, true);
        if(voronoiLines) this.#renderer.drawVoronoi(this.#stippleBuffer, false);
    }

}

/**
 * Provides WebGL rendering functionality
 */
class Renderer {
    #canvas;
    #gl;
    #shaderDots;
    #shaderLines;
    #vboDots;
    #vboLines;

    clear = [0.5, 0.5, 0.5];
    color = [0.2, 0.2, 0.2];

    /**
     * constructor of Renderer
     * @param canvas used for the WebGL context to draw to
     */
    constructor(canvas) {
        this.#canvas = canvas;
        this.#gl = canvas.getContext(
            'webgl',
            {antialias: false, alpha: true, preserveDrawingBuffer: true}
        );
        this.#init_shader();

        //init buffers
        this.#vboDots = this.#gl.createBuffer();
        this.#vboLines = this.#gl.createBuffer();

        this.clear = COLOR_WEBGL_BACK;
        this.color = COLOR_WEBGL_FRONT;
    }

    /**
     * drawing dots to the WebGL context specified
     * @param data float buffer with stride 3: x,y,radius
     * @param clearBefore if false, no clear is called and already rendered content remains
     */
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

    /**
     * drawing voronoi cells to the WebGL context specified.
     * the voronoi cells are generated in this function, which is not as performant as it could be.
     * this function is supposed to be used for debugging purposes only.
     * @param data float buffer with stride 3: x,y,radius
     * @param clearBefore if false, no clear is called and already rendered content remains
     */
    drawVoronoi(data, clearBefore = true) {
        //generate voronoi
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

        //init
        this.#fixCanvas();
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

    /**
     * Fixes the actual width and height of the canvas and returns it
     * @returns {*[]} actual width and height of the used canvas
     */
    getCanvasDimension() {
        this.#fixCanvas();
        return [this.#canvas.width, this.#canvas.height];
    }

    /**
     * Compiles shaders based on the code found on the html page
     */
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

    /**
     * fixes the actual width and height values of the canvas
     */
    #fixCanvas() {
        this.#canvas.width = this.#canvas.clientWidth;
        this.#canvas.height = this.#canvas.clientHeight;
    }

    /**
     * general draw functions called before drawing
     * @param clearBefore if false, no clear is called and already rendered content remains
     */
    #prepareDrawing(clearBefore) {
        this.#gl.enable(this.#gl.BLEND);
        this.#gl.blendFunc(this.#gl.SRC_ALPHA, this.#gl.ONE_MINUS_SRC_ALPHA);
        if(clearBefore) {
            this.#gl.clearColor(this.clear[0], this.clear[1], this.clear[2], 1.0);
            this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);
        }
        this.#gl.viewport(0,0,this.#canvas.width, this.#canvas.height);
    }

}

//----------------------------------------------------------------------------------------------------------------------
//endregion
