# Copy this directory to ns-3/contrib/visual-logger, then use the usual
# ./ns3 configure / ./ns3 build. Select the installed Aqua-Sim module name.
set(VISUAL_LOGGER_AQUASIM_MODULE "aqua-sim-tg" CACHE STRING "Installed Aqua-Sim module name")
if(NOT DEFINED lib${VISUAL_LOGGER_AQUASIM_MODULE})
  message(FATAL_ERROR "visual-logger needs the enabled module ${VISUAL_LOGGER_AQUASIM_MODULE}; set VISUAL_LOGGER_AQUASIM_MODULE to its actual name")
endif()
# ns-3 scans literal library references before evaluating CMake. Keep this
# configurable dependency indirect, and require it in the enabled module list.
set(aqua_sim_target_name "lib${VISUAL_LOGGER_AQUASIM_MODULE}")
build_lib(
  LIBNAME visual-logger
  SOURCE_FILES helper/visual-log-helper.cc
  HEADER_FILES helper/visual-log-helper.h
  LIBRARIES_TO_LINK ${libcore} ${libnetwork} ${libmobility} ${${aqua_sim_target_name}}
)
