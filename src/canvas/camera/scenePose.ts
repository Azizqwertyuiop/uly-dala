import { Vector3 } from "three";
import type { RigPose } from "./rig";

/*
 * Поза камеры от сцены главы (dolly zoom «Огня»). Сцена пишет в своём кадре, Stage передаёт
 * в CameraRig (фаза damping). active = false — камера идёт по общему пути сайта.
 */
export const scenePose: RigPose & { active: boolean } = {
  active: false,
  position: new Vector3(),
  target: new Vector3(),
  focal: 50,
  still: 0,
  weight: 0,
};
