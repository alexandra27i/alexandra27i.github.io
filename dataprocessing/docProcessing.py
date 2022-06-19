import reverse_geocoder as rg
import os
from PIL import Image
import pycountry
import pandas as pd
import json



def create_b64_from_image(source, destination):
    print("creating b64 from {} ...".format(source))

    im = Image.open(source, 'r')
    width, height = im.size
    pixels = list(im.getdata())
    result = bytearray(3*width*height)

    for y in range(0, height):
        for x in range(0, width):
            pixel = pixels[y * width + x]
            result[y * width*3 + x*3 + 0] = pixel[0]
            result[y * width*3 + x*3 + 1] = pixel[1]
            result[y * width*3 + x*3 + 2] = pixel[2]

    with open(destination, "w", encoding="utf-8") as dest:
        dest.write(result.hex())


if __name__ == '__main__':
    create_b64_from_image("doc/_stippled_for_doc.png", "doc/_stippled_for_doc.b64")
