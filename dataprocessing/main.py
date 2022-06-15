import reverse_geocoder as rg
import io
from PIL import Image
import pycountry
import pandas as pd
import json

offset_header_2dsf = 8


def country_from_geolocation(lat, lon):
    results = rg.search((lat, lon))
    if len(results) == 0: return ""
    result = results[0]

    return pycountry.countries.get(alpha_2=result["cc"]).name


def create_2dsf(width, height):
    result = bytearray(8 + width * height)
    result[0] = (width & 0x000000FF)
    result[1] = (width & 0x0000FF00) >> 8
    result[2] = (width & 0x00FF0000) >> 16
    result[3] = (width & 0xFF000000) >> 24
    result[4] = (height & 0x000000FF)
    result[5] = (height & 0x0000FF00) >> 8
    result[6] = (height & 0x00FF0000) >> 16
    result[7] = (height & 0xFF000000) >> 24
    return result

def create_2dsf_from_covid_table_who():
    print("creating covid map data...")

    # load covid data
    df = pd.read_csv("data/WHO-COVID-19-global-table-data.csv", header=0)

    result = {}
    for index, row in df.iterrows():
        key = row["Name"]
        value = row["Cases - cumulative total"]

        #use cc codes instead of country names (we can fix this more easily to work with world geo data)
        cc = ""
        if key == "Global":
            cc = "GLOBAL"
        elif key == "Other":  # this will be recognized as united kingdom, dont ask me why
            cc = "OTHER"
        elif key == "The United Kingdom":
            cc = "GBR"
        elif key == "Iran (Islamic Republic of)":
            cc = "IRN"
        elif key == "Democratic Republic of the Congo":
            cc = "COD"
        elif key == "Venezuela (Bolivarian Republic of)":
            cc = "VEN"
        elif key == "United States Virgin Islands":
            cc = "VIR"
        elif key == "Northern Mariana Islands (Commonwealth of the)":
            cc = "MNP"
        elif key == "Micronesia (Federated States of)":
            cc = "FSM"
        elif key == "Côte d’Ivoire":
            cc = "CIV"
        elif key == "Bolivia (Plurinational State of)":
            cc = "BOL"
        else:
            try:
                cc = (pycountry.countries.search_fuzzy(key)[0]).alpha_3
            except:
                print("failed for {}".format(key))
                continue #block those unknown

        result[cc] = value

    fw = open("data/covid.json", "w", encoding="utf-8")
    fw.write(json.dumps(result))
    fw.close()


def deprecated_create_2dsf_from_covid_table_who():
    # I think this works, but it takes ~18h to compute for an accuracy of 1 degree (180x360)
    # this is horrible, so I will do something else instead

    print("creating covid map...")

    # load covid data
    df = pd.read_csv("data/WHO-COVID-19-global-table-data.csv", header=0)
    cases = df[["Name", "Cases - cumulative total"]].rename(columns={"Name": "country", "Cases - cumulative total": "cases"})
    totalCases = cases[cases["country"] == "Global"]["cases"].values[0]

    # load world map data (mask for lat/lon)
    im = Image.open("data/worldmap.jpg", 'r')
    width, height = im.size
    pixels = list(im.getdata())
    result = create_2dsf(width, height)

    # lat/lon are in range -90,90 and -180,180
    # the image size is 180x360
    for y in range(0, height):      # y = lat
        for x in range(0, width):   # x = lon
            i = offset_header_2dsf + y * width + x
            pixel = pixels[y * width + x]
            if pixel[0] < 127 and pixel[1] < 127 and pixel[2] < 127:  # mask with binary threshold at 0.5*255
                coords = [(x/width * 360) - 180, (y/height * 180) - 90]
                country = country_from_geolocation(coords[0], coords[1])
                casesEntry = cases[cases["country"] == country]["cases"]
                if country == "" or casesEntry.size == 0:
                    print("country unknown: .{}.".format(country))
                    continue  # reverse geo search failed

                casesForCountry = casesEntry.values[0]
                result[i] = int(casesForCountry/totalCases * 255.0)
            else:
                result[i] = 255

    fw = open("data/covid.2dsf", "w", encoding="utf-8")
    fw.write(result.hex())
    fw.close()


def create_2dsf_from_image_ignore_gray(path):
    print("grayscaling {} ...".format(path))

    im = Image.open(path, 'r')
    width, height = im.size
    pixels = list(im.getdata())
    result = create_2dsf(width, height)

    for y in range(0, height):
        for x in range(0, width):
            i = offset_header_2dsf + y * width + x
            pixel = pixels[y * width + x]
            if pixel[0] == pixel[1] and pixel[0] == pixel[2]:
                result[i] = 255  # ignore gray
            else:
                result[i] = int((pixel[0] + pixel[1] + pixel[2]) / 3)
    fw = open(path + ".2dsf", "w", encoding="utf-8")
    fw.write(result.hex())
    fw.close()


if __name__ == '__main__':
    fw = open("../res/data.js", "w", encoding="utf-8")

    #create_2dsf_from_image_ignore_gray("data/population_usa.png")
    #create_2dsf_from_image_ignore_gray("data/population_world.png")
    #create_2dsf_from_image_ignore_gray("data/islam_world.png")
    create_2dsf_from_image_ignore_gray("data/christianity_world.png")
    #create_2dsf_from_image_ignore_gray("data/ufo.png")

    #create_2dsf_from_covid_table_who()

    fw.close()
