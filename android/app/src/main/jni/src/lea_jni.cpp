#include <jni.h>
#include <string>
#include "pipeline.hpp"

extern "C" JNIEXPORT jstring JNICALL
Java_com_leastudio_app_LeaBridge_nativeSd(JNIEnv* env, jobject, jstring jprompt, jstring jdir, jstring jout) {
    const char* prompt = env->GetStringUTFChars(jprompt, nullptr);
    const char* dir = env->GetStringUTFChars(jdir, nullptr);
    const char* out = env->GetStringUTFChars(jout, nullptr);
    std::string err;
    try {
        diffusion::Pipeline pipe(dir);
        bool ok = pipe.run(prompt ? prompt : "a woman", out ? out : "/dev/null");
        if (!ok) err = "pipeline.run a échoué";
    } catch (const std::exception& e) {
        err = e.what();
    } catch (...) {
        err = "exception native MNN";
    }
    env->ReleaseStringUTFChars(jprompt, prompt);
    env->ReleaseStringUTFChars(jdir, dir);
    env->ReleaseStringUTFChars(jout, out);
    if (!err.empty()) return env->NewStringUTF(err.c_str());
    return env->NewStringUTF("OK");
}
