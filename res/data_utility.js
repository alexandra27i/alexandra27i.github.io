class Data_utility {

    /**
     * Convert a hex string to a byte array
     * @param hex base64 string
     * @returns {array} bytearray
     */
    static hexToBytes(hex) {
        for (var bytes = [], c = 0; c < hex.length; c += 2)
            bytes.push(parseInt(hex.substr(c, 2), 16));
        return bytes;
    }

    /**
     * returns width and height from the base64 encoded preprocessed image
     * @param data base64 encoded preprocessed image
     * @returns {array} [width, height]
     */
    static getDimensionsFrom2DSF(data) {
        let width = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
        let height = data[4] + (data[5] << 8) + (data[6] << 16) + (data[7] << 24);

        return [width, height];
    }

    /**
     * converts base64 image to 2D array
     * @param _data base64 image
     * @returns {array} image as 2D array
     */
    static convertDataTo2D(_data) {
        let data = Data_utility.hexToBytes(_data);
        let [width, height] = Data_utility.getDimensionsFrom2DSF(data);

        let result = Array.from(Array(width), () => new Array(height));
        for (let i = 8; i < data.length; i++) {
            let y = Math.trunc((i - 8) / width);
            let x = (i - 8) - y * width;

            result[x][height - 1 - y] = data[i]; //flip y
        }

        return result;
    }

    /**
     * transforms preprocessed covid data to a 2D array
     * @param _data preprocessed covid data
     * @param callback callback to be called once the computation finishes
     */
    static convertCovidDataTo2D(_data, callback) {
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
            .fitSize([width, height * 1.5], wm)
            .center([0, 0])
            .translate([width / 2, height / 2])
        ;

        var colorScale = d3.scaleLinear() //this might not be perfect - feel free to adjust it if you want
            .domain([0, 200000, 1000000, 20000000])
            .range(["smokewhite", "lightgray", "gray", "black"]);

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
            context.clearRect(0, 0, width, height);
            context.rect(0, 0, width, height);
            context.fillStyle = "white";
            context.fill();

            //draw stuff to retrieve the subpixels and grayscale the whole thing
            context.drawImage(image, 0, 0, width, height);
            let subpixels = context.getImageData(0, 0, width, height).data;
            let result = Array.from(Array(width), () => new Array(height));
            for (let i = 0; i < subpixels.length; i += 4) {
                let y = Math.trunc((i / 4) / width);
                let x = (i / 4) - y * width;

                result[x][height - 1 - y] = (subpixels[i] + subpixels[i + 1] + subpixels[i + 2]) / 3; //flip y
            }
            callback(result);
        };

        let svgnode = svg.node();
        let imgsrc = "<svg xmlns='http://www.w3.org/2000/svg'>" + svgnode.innerHTML + "</svg>";
        image.src = "data:image/svg+xml;base64," + window.btoa(imgsrc);
    }

    /**
     * contains ready-to-use preprocessed data
     */
    static data_mapping = null;

    /**
     * initializes ready-to-use preprocessed data
     */
    static init_data() {
        Data_utility.data_mapping = {
            "population_usa":           Data_utility.convertDataTo2D(population_usa),
            "population_world":         Data_utility.convertDataTo2D(population_world),
            "islam":                    Data_utility.convertDataTo2D(islam_world),
            "christianity":             Data_utility.convertDataTo2D(christianity_world),
            "buddhism":                 Data_utility.convertDataTo2D(buddhist_world),
            "ufos":                     Data_utility.convertDataTo2D(ufo),
            "austria_heightmap":        Data_utility.convertDataTo2D(austria_heightmap),
            "germany_heightmap":        Data_utility.convertDataTo2D(germany_heightmap),
            "generic_heightmap":        Data_utility.convertDataTo2D(generic_heightmap),
            "heightmap_world":          Data_utility.convertDataTo2D(heightmap_world)
        };
        Data_utility.convertCovidDataTo2D(covid, (result) => {
            Data_utility.data_mapping["covid"] = result;
        });
    }

}