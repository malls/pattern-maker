# PM-3: Scaffold pattern making software

We are making a web image maker. This is a software with two modes. It could be a web app or desktop software, discuss with me about which is best.

Main menu: typical eye dropper, pen, line, and shape tools, color selector etc. appear above the main UI. On the left, we have a 3x3 grid. on the right, we have rendered output.

Mode 1: Border image.
Output: Images that can be used as css border-images. These are square images, that are understood within the css rules as a 3x3 grid, with an empty middle section
UI: a 3x3 square grid. configurable pixel size. draw in each section, and rendered examples appear to the side for each of the border-image style rules


Mode 2: Repeating background image
Output: images that will be tiled, for example in the context of css background-images
UI: 3x3 square grid, with the middle section being the implied main drawing canvas. All grid boxes can be drawn in. Delineation is faint. drawing in this adds what's being drawn to the other sections as well, and the user can draw a line from one box to another.



Typical UX patterns of drawing software should be present, hotkeys, etc
