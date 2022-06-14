import reverse_geocoder as rg
import io
from PIL import Image

offset_header_2dsf = 8
def create_2dsf(width, height):
    result = bytearray(8+width*height)
    result[0] = (width & 0x000000FF)
    result[1] = (width & 0x0000FF00) >> 8
    result[2] = (width & 0x00FF0000) >> 16
    result[3] = (width & 0xFF000000) >> 24
    result[4] = (height & 0x000000FF)
    result[5] = (height & 0x0000FF00) >> 8
    result[6] = (height & 0x00FF0000) >> 16
    result[7] = (height & 0xFF000000) >> 24
    return result


def create_2dsf_from_covid_table_WHO():
    #coordinates = (0, 0)
    #results = rg.search(coordinates)
    #print(results)

    print("not implemented yet")

def create_2dsf_from_image_ignore_gray(path):
    print("grayscaling {} ...".format(path))

    im = Image.open(path, 'r')
    width, height = im.size
    pixel_values = list(im.getdata())
    result = create_2dsf(width, height)

    for y in range(0, height):
        for x in range(0, width):
            i = offset_header_2dsf + y * width + x
            r = pixel_values[y*width+x][0]
            g = pixel_values[y*width+x][1]
            b = pixel_values[y*width+x][2]
            if r == g and r == b:
                result[i] = 255 #ignore gray
            else:
                result[i] = int((r + g + b) / 3)
    fw = open(path + ".2dsf", "w", encoding="utf-8")
    fw.write(result.hex())
    fw.close()


if __name__ == '__main__':
    #create_2dsf_from_covid_table_WHO()
    create_2dsf_from_image_ignore_gray("data/population_usa.png")
    create_2dsf_from_image_ignore_gray("data/population_world.png")
    create_2dsf_from_image_ignore_gray("data/islam_world.png")