#!/bin/bash
# 2700 frames in 3 parallel segments, then a lossless concat
cd "$(dirname "$0")"
node render.mjs video 2 0 900 out/seg0.mp4 > out/log0.txt 2>&1 &
node render.mjs video 2 900 1800 out/seg1.mp4 > out/log1.txt 2>&1 &
node render.mjs video 2 1800 2700 out/seg2.mp4 > out/log2.txt 2>&1 &
wait
printf "file 'seg0.mp4'\nfile 'seg1.mp4'\nfile 'seg2.mp4'\n" > out/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -c copy out/picture.mp4 && echo DONE
