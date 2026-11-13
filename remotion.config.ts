import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// As cenas 3D (three.js) precisam de WebGL no navegador do render.
Config.setChromiumOpenGlRenderer("angle");
