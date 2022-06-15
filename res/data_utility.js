// Convert a hex string to a byte array
function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

// Convert a byte array to a hex string
function bytesToHex(bytes) {
    for (var hex = [], i = 0; i < bytes.length; i++) {
        var current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
        hex.push((current >>> 4).toString(16));
        hex.push((current & 0xF).toString(16));
    }
    return hex.join("");
}

function getDimensionsFrom2DSF(data) {
    let width = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
    let height = data[4] + (data[5] << 8) + (data[6] << 16) + (data[7] << 24);

    return [width, height];
}

function convertDataTo2D(_data) {
    let data = hexToBytes(_data);
    [width, height] = getDimensionsFrom2DSF(data);

    let result = Array.from(Array(width), () => new Array(height));
    for(let i = 8; i < data.length; i++) {
        let y = Math.trunc((i-8) / width);
        let x = (i-8) - y * width;

        result[x][height-1-y] = data[i]; //flip y
    }

    return result;
}

function convertCovidDataTo2D(_data, callback) {
    let width = 4000;
    let height = 2000;
    let data = JSON.parse(_data);
    let totalCases = data["Global"];
    let wm = JSON.parse(worldmap);

    //draw the map to an offscreen canvas
    let svg_root = document.createElement("canvas");
    svg_root.width = width;
    svg_root.height = height;


    let svg = d3.select(svg_root)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(0, 0)");

    var projection = d3.geoMercator()
        .fitSize([width, height*1.5], wm)
        .center([0,0])
        .translate([width/2, height/2])
    ;

    var colorScale = d3.scaleLinear() //this might not be perfect - feel free to adjust it if you want
        .domain([0           , 200000     , 1000000 , 20000000])
        .range( ["smokewhite", "lightgray", "gray"  , "black"]);

    svg.append("g")
        .selectAll("path")
        .data(wm.features)
        .enter()
        .append("path")
        .attr("d", d3.geoPath().projection(projection))
        .attr("fill", (t) => {
            let cc = t.id;
            let cases = cc in data ? data[cc] : 0;
            return colorScale(cases);
        })
        .style("stroke", "black")

    //turn svg into grayscaled data
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    var image = new Image();
    image.onload = () => {
        //start with a white canvas
        context.clearRect ( 0, 0, width, height );
        context.rect(0, 0, width, height);
        context.fillStyle = "white";
        context.fill();

        //draw stuff to retrieve the subpixels and grayscale the whole thing
        context.drawImage(image, 0, 0, width, height);
        let subpixels = context.getImageData(0, 0, width, height).data;
        let result = Array.from(Array(width), () => new Array(height));
        for(let i = 0; i < subpixels.length; i+=4) {
            let y = Math.trunc((i/4) / width);
            let x = (i/4) - y * width;

            result[x][height-1-y] = (subpixels[i]+subpixels[i+1]+subpixels[i+2])/3; //flip y
        }
        callback(result);
    };

    let svgnode = svg.node();
    let imgsrc = "<svg xmlns='http://www.w3.org/2000/svg'>" + svgnode.innerHTML + "</svg>";
    image.src = "data:image/svg+xml;base64," + window.btoa(imgsrc);
}

var data_mapping = null;

function init_data() {
    data_mapping = {
        "population_usa": convertDataTo2D(population_usa),
        "population_world": convertDataTo2D(population_world),
        "islam": convertDataTo2D(islam_world),
        "christianity": convertDataTo2D(christianity_world),
        "buddhism": convertDataTo2D(buddhist_world),
        "ufos": convertDataTo2D(ufo),
        "austria_heightmap": convertDataTo2D(austria_heightmap),
        "germany_heightmap": convertDataTo2D(germany_heightmap),
        "generic_heightmap": convertDataTo2D(generic_heightmap),
        "heightmap_world": convertDataTo2D(heightmap_world)
    };
    convertCovidDataTo2D(covid, (result) => {
        data_mapping["covid"] = result;
    });
}