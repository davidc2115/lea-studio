cmake_minimum_required(VERSION 3.18)
project(lea_local)
set(CMAKE_CXX_STANDARD 17)

add_library(MNN SHARED IMPORTED)
set_target_properties(MNN PROPERTIES
  IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/prebuilt/${ANDROID_ABI}/libMNN.so)

add_library(lea_local SHARED
  src/pipeline.cpp
  src/tokenizer.cpp
  src/lea_jni.cpp)

target_include_directories(lea_local PRIVATE
  ${CMAKE_SOURCE_DIR}/include
  ${CMAKE_SOURCE_DIR}/include/MNN)

target_link_libraries(lea_local MNN log)
