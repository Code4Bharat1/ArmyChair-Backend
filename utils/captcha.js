import svgCaptcha from "svg-captcha";

const store = new Map();

export const createCaptcha = () => {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 3,
    ignoreChars: "0oO1ilI",
    color: true,
    background: "#f4f4f4",
  });

  const id = Date.now().toString();

  store.set(id, captcha.text.toLowerCase());

  // auto-expire in 2 minutes
  setTimeout(() => store.delete(id), 2 * 60 * 1000);

  return { id, svg: captcha.data };
};

export const verifyCaptcha = (id, value) => {
  if (!store.has(id)) return false;
  const valid = store.get(id) === value.toLowerCase();
  store.delete(id);
  return valid;
};
