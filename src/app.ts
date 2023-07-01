// Made By TheNosiriN

// basic example of the marching cubes iso surface extraction algorithm
// there are no performance optimizations

// I have not yet made it editable but to do this 
// you'd have to cast a ray from the mouse position
// and the position where it hits on the mesh is your cell position
// you could divide then floor this position by the chunkWidth to get the chunk its in
// and you could divide then floor it by cell size+1 to get the particular cell corner its in
// then set the value of the cell corner to whatever you want with zero for empty
// then remarch just the cell position
// then rebuild the mesh


