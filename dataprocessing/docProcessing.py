import reverse_geocoder as rg
import os
from PIL import Image
import pycountry
import pandas as pd
import json
import base64


def create_b64_from_image(source, destination):
    print("creating b64 from {} ...".format(source))

    with open(source, "rb") as src:
        encoded_string = base64.b64encode(src.read())
        with open(destination, "wb") as dest:
            dest.write(encoded_string)


if __name__ == '__main__':
    create_b64_from_image("doc/_stippled_for_doc.png", "doc/_stippled_for_doc.b64")
