import { WorldShape } from "./chunk";

export class Mandelbulb implements WorldShape {
    maxIterations = 50;
    getDensity(x: number, y: number, z: number) {
        let s = 1 / 50;
        return 1 - mandelbulb(x * s, y * s, z * s, this.maxIterations);
    }
}

function mandelbulb(x: number, y: number, z: number, maxIterations: number) {
    var origX = x;
    var origY = y;
    var origZ = z;
    var dr = 1.0;
    var r = 0.0;
    for (var i = 0; i < maxIterations; i++) {
        r = Math.sqrt(x * x + y * y + z * z);
        if (r > 2.0) break;

        // compute theta and phi
        var theta = Math.acos(z / r);
        var phi = Math.atan2(y, x);

        dr = Math.pow(r, 7.0) * 8.0 * dr + 1.0;

        // scale and rotate the point
        var zr = Math.pow(r, 8.0);
        theta = theta * 8.0;
        phi = phi * 8.0;

        // convert back to cartesian coordinates
        x = zr * Math.sin(theta) * Math.cos(phi) + origX;
        y = zr * Math.sin(theta) * Math.sin(phi) + origY;
        z = zr * Math.cos(theta) + origZ;
    }
    return r;
}


/*the density function for generating volumetric data for a cell using 3D perlin noise
you could research on this starting from here: https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu
note that the density function doesnt have to be noise its the iso surface extraction function
a little bit more math can be used to make interesting things*/
/*
function getDensity2(x:number, y:number, z:number, yVal:number, floor:number) {
    var density = 0;

    var f = frequency;
    var a = amplitude; //terracing: density += (-yVal + val + yVal % terraceHeight) - floor;

    for (var i = 0; i < octaves; i++) {
        //warping world coords
        var warp = perlin.noise3D(x * warpFrequency, y * warpFrequency, z * warpFrequency);
        x += warp * warpAmplitude;
        y += warp * warpAmplitude;
        z += warp * warpAmplitude;

        //setting density
        var val = perlin.noise3D(x * f, y * f, z * f) * a;
        density += (-yVal + val) - floor;
        f *= roughness;
        a *= persistence;
    }

    return density;
}
    //
*/




