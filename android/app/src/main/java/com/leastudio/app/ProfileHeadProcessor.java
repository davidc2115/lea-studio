package com.leastudio.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PointF;
import android.media.FaceDetector;
import android.util.Base64;
import org.json.JSONObject;
import org.opencv.android.OpenCVLoader;
import org.opencv.android.Utils;
import org.opencv.core.CvType;
import org.opencv.core.Mat;
import org.opencv.core.Point;
import org.opencv.core.Scalar;
import org.opencv.core.Size;
import org.opencv.imgproc.Imgproc;
import java.io.ByteArrayOutputStream;

/** Local reference preparation only. No network, gallery or conversation writes. */
final class ProfileHeadProcessor {
    private static final int WIDTH = 384, HEIGHT = 512;

    private ProfileHeadProcessor() {}

    static String prepare(String encoded) {
        Bitmap source = null, detectorBitmap = null, head = null, smallHead = null;
        Bitmap stage = null, maskBitmap = null;
        Mat rgba = null, rgb = null, labels = null;
        Mat background = null, foreground = null, alpha = null;
        try {
            if (encoded == null || encoded.length() > 3_000_000) {
                throw new IllegalArgumentException("Référence trop volumineuse.");
            }
            if (!OpenCVLoader.initLocal()) {
                throw new IllegalStateException("Segmentation locale indisponible.");
            }
            rgba = new Mat(); rgb = new Mat(); labels = new Mat();
            background = new Mat(); foreground = new Mat(); alpha = new Mat();
            int comma = encoded.indexOf(',');
            if (encoded.startsWith("data:") && comma >= 0) encoded = encoded.substring(comma + 1);
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
            if (opts.outWidth < 64 || opts.outHeight < 64) {
                throw new IllegalArgumentException("Référence illisible ou trop petite.");
            }
            int sample = 1;
            while (Math.max(opts.outWidth, opts.outHeight) / sample > 1024) sample *= 2;
            opts.inSampleSize = sample;
            opts.inJustDecodeBounds = false;
            opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            source = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
            if (source == null) throw new IllegalArgumentException("Référence non décodable.");
            int width = source.getWidth(), height = source.getHeight();
            detectorBitmap = Bitmap.createBitmap(width & ~1, height, Bitmap.Config.RGB_565);
            new Canvas(detectorBitmap).drawBitmap(source, 0, 0, null);
            FaceDetector.Face[] faces = new FaceDetector.Face[2];
            int count = new FaceDetector(detectorBitmap.getWidth(), height, 2).findFaces(detectorBitmap, faces);
            if (count != 1 || faces[0] == null || faces[0].confidence() < .35f) {
                throw new IllegalArgumentException("Choisis une référence avec un seul visage adulte bien visible de face.");
            }
            PointF eyes = new PointF();
            faces[0].getMidPoint(eyes);
            float distance = faces[0].eyesDistance();
            if (distance < 12) throw new IllegalArgumentException("Visage trop petit dans la référence.");
            int left = Math.max(0, (int) Math.floor(eyes.x - 1.9 * distance));
            int top = Math.max(0, (int) Math.floor(eyes.y - 2.3 * distance));
            int right = Math.min(width, (int) Math.ceil(eyes.x + 1.9 * distance));
            int bottom = Math.min(height, (int) Math.ceil(eyes.y + 2.5 * distance));

            Utils.bitmapToMat(source, rgba);
            Imgproc.cvtColor(rgba, rgb, Imgproc.COLOR_RGBA2RGB);
            labels.create(height, width, CvType.CV_8UC1);
            labels.setTo(new Scalar(Imgproc.GC_BGD));
            Imgproc.rectangle(labels, new Point(left, top), new Point(right - 1, bottom - 1),
                    new Scalar(Imgproc.GC_PR_FGD), -1);
            Imgproc.ellipse(labels, new Point(eyes.x, eyes.y + .6 * distance),
                    new Size(.85 * distance, 1.3 * distance), 0, 0, 360,
                    new Scalar(Imgproc.GC_FGD), -1);
            Imgproc.ellipse(labels, new Point(eyes.x, eyes.y - 1.3 * distance),
                    new Size(.9 * distance, .35 * distance), 0, 0, 360,
                    new Scalar(Imgproc.GC_FGD), -1);
            Imgproc.grabCut(rgb, labels, new org.opencv.core.Rect(), background, foreground,
                    6, Imgproc.GC_INIT_WITH_MASK);
            byte[] labelPixels = new byte[width * height];
            labels.get(0, 0, labelPixels);
            for (int i = 0; i < labelPixels.length; i++) {
                int value = labelPixels[i] & 255;
                labelPixels[i] = (byte) ((value == Imgproc.GC_FGD || value == Imgproc.GC_PR_FGD) ? 255 : 0);
            }
            fillHoles(labelPixels, width, height);
            alpha.create(height, width, CvType.CV_8UC1);
            alpha.put(0, 0, labelPixels);
            Imgproc.GaussianBlur(alpha, alpha, new Size(3, 3), .7);
            alpha.get(0, 0, labelPixels);
            int minX = width, minY = height, maxX = -1, maxY = -1;
            int[] colours = new int[width * height];
            source.getPixels(colours, 0, width, 0, 0, width, height);
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    int i = y * width + x, opacity = labelPixels[i] & 255;
                    colours[i] = (opacity << 24) | (colours[i] & 0x00ffffff);
                    if (opacity > 8) {
                        minX = Math.min(minX, x); minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                    }
                }
            }
            if (maxX - minX < 32 || maxY - minY < 40) {
                throw new IllegalArgumentException("Segmentation du visage insuffisante.");
            }
            Bitmap fullHead = Bitmap.createBitmap(colours, width, height, Bitmap.Config.ARGB_8888);
            head = Bitmap.createBitmap(fullHead, minX, minY, maxX - minX + 1, maxY - minY + 1);
            if (head != fullHead) fullHead.recycle();
            float scale = Math.min(116f / head.getWidth(), 146f / head.getHeight());
            int headWidth = Math.max(1, Math.round(head.getWidth() * scale));
            int headHeight = Math.max(1, Math.round(head.getHeight() * scale));
            smallHead = Bitmap.createScaledBitmap(head, headWidth, headHeight, true);
            int dx = (WIDTH - headWidth) / 2, dy = 20;
            stage = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(stage);
            canvas.drawColor(0xffa6a49e);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            android.graphics.RectF destination = new android.graphics.RectF(
                    dx - minX * scale, dy - minY * scale,
                    dx - minX * scale + width * scale, dy - minY * scale + height * scale);
            canvas.drawBitmap(source, null, destination, paint);
            int[] patch = new int[headWidth * headHeight];
            smallHead.getPixels(patch, 0, headWidth, 0, 0, headWidth, headHeight);
            byte[] protectedPixels = new byte[WIDTH * HEIGHT];
            for (int y = 0; y < headHeight; y++) {
                for (int x = 0; x < headWidth; x++) {
                    protectedPixels[(dy + y) * WIDTH + dx + x] =
                            (byte) (((patch[y * headWidth + x] >>> 24) > 127) ? 255 : 0);
                }
            }
            // A one-pixel contour is regenerated; the complete interior stays protected.
            byte[] eroded = protectedPixels.clone();
            for (int y = 1; y < HEIGHT - 1; y++) {
                for (int x = 1; x < WIDTH - 1; x++) {
                    boolean keep = true;
                    for (int yy = -1; yy <= 1 && keep; yy++) {
                        for (int xx = -1; xx <= 1; xx++) {
                            if ((protectedPixels[(y + yy) * WIDTH + x + xx] & 255) == 0) {
                                keep = false; break;
                            }
                        }
                    }
                    eroded[y * WIDTH + x] = (byte) (keep ? 255 : 0);
                }
            }
            fillHoles(eroded, WIDTH, HEIGHT);
            int[] maskColours = new int[WIDTH * HEIGHT];
            for (int i = 0; i < maskColours.length; i++) {
                maskColours[i] = ((eroded[i] & 255) == 255) ? 0xff000000 : 0xffffffff;
            }
            maskBitmap = Bitmap.createBitmap(maskColours, WIDTH, HEIGHT, Bitmap.Config.ARGB_8888);
            JSONObject result = new JSONObject();
            result.put("ok", true);
            result.put("source_image", encode(stage, Bitmap.CompressFormat.WEBP, 98));
            result.put("source_mask", encode(maskBitmap, Bitmap.CompressFormat.PNG, 100));
            result.put("head_image", encode(smallHead, Bitmap.CompressFormat.PNG, 100));
            result.put("head_x", dx); result.put("head_y", dy);
            result.put("head_width", headWidth); result.put("head_height", headHeight);
            result.put("width", WIDTH); result.put("height", HEIGHT);
            return result.toString();
        } catch (Throwable error) {
            try {
                return new JSONObject().put("ok", false)
                        .put("error", error.getMessage() == null ? "Préparation du visage impossible." : error.getMessage())
                        .toString();
            } catch (Exception ignored) {
                return "{\"ok\":false,\"error\":\"Préparation du visage impossible.\"}";
            }
        } finally {
            for (Mat mat : new Mat[]{rgba, rgb, labels, background, foreground, alpha}) {
                if (mat != null) mat.release();
            }
            for (Bitmap bitmap : new Bitmap[]{source, detectorBitmap, head, smallHead, stage, maskBitmap}) {
                if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
            }
        }
    }

    private static String encode(Bitmap bitmap, Bitmap.CompressFormat format, int quality) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!bitmap.compress(format, quality, out)) throw new IllegalStateException("Encodage de la référence impossible.");
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    /** Fill interior matte holes without expanding the silhouette into its background. */
    private static void fillHoles(byte[] pixels, int width, int height) {
        boolean[] outside = new boolean[pixels.length];
        int[] queue = new int[pixels.length];
        int read = 0, write = 0;
        for (int i = 0; i < pixels.length; i++) {
            int x = i % width, y = i / width;
            if ((x == 0 || y == 0 || x == width - 1 || y == height - 1) && (pixels[i] & 255) == 0) {
                outside[i] = true; queue[write++] = i;
            }
        }
        while (read < write) {
            int i = queue[read++], x = i % width, y = i / width;
            int[] neighbours = {x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1,
                    y > 0 ? i - width : -1, y < height - 1 ? i + width : -1};
            for (int n : neighbours) {
                if (n >= 0 && !outside[n] && (pixels[n] & 255) == 0) {
                    outside[n] = true; queue[write++] = n;
                }
            }
        }
        for (int i = 0; i < pixels.length; i++) if (!outside[i]) pixels[i] = (byte) 255;
    }
}
