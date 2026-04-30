import os
import sys
import base64


def get_data_uri(image_path):
	mime_type = "image/png" if image_path.endswith(".png") else "image/jpeg"

	with open(image_path, "rb") as f:
		encoded = base64.b64encode(f.read()).decode("utf-8")

	html_text = f"data:{mime_type};base64,{encoded}"

	return html_text


if __name__ == "__main__":
	args = sys.argv
	image_path = args[1]
	html_text = get_data_uri(image_path)

	print(html_text)

