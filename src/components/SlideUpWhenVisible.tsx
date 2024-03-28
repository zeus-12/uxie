import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";

interface SlideUpWhenVisibleProps {
  threshold?: number;
  children: React.ReactNode;
}

const SlideUpWhenVisible: React.FC<SlideUpWhenVisibleProps> = ({
  children,
  threshold,
}) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({ threshold: threshold ? threshold : 0.35 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);
  return (
    <motion.div
      ref={ref}
      animate={controls}
      initial="hidden"
      transition={{ duration: 0.4 }}
      variants={{
        visible: { opacity: 1, y: 0 },
        hidden: { opacity: 0, y: 20 },
      }}
    >
      {children}
    </motion.div>
  );
};

export default SlideUpWhenVisible;
