import xss from "xss";

const messages_default = {
  es: {
    required: (f) => `El campo ${f} es obligatorio`,
    min: (f, n) => `El campo ${f} debe tener al menos ${n} caracteres`,
    max: (f, n) => `El campo ${f} no puede tener más de ${n} caracteres`,
    email: (f) => `El campo ${f} debe ser un email válido`,
    number: (f) => `El campo ${f} debe ser numérico`,
    alpha: (f) => `El campo ${f} solo puede contener letras`,
    alphanumeric: (f) => `El campo ${f} solo puede contener letras y números`,
    boolean: (f) => `El campo ${f} debe ser verdadero o falso`,
    date: (f) => `El campo ${f} debe ser una fecha válida`,
    url: (f) => `El campo ${f} debe ser una URL válida`,
    in: (f, v) => `El campo ${f} debe ser uno de: ${v.join(", ")}`,
    equals: (f, v) => `El campo ${f} debe ser igual a ${v}`,
    password: () => `La contraseña debe tener mayúsculas, minúsculas y números`,
    pattern: (f) => `El campo ${f} no cumple el patrón requerido`,
  },
  en: {
    required: (f) => `${f} is required`,
    min: (f, n) => `${f} must be at least ${n} characters`,
    max: (f, n) => `${f} must be at most ${n} characters`,
    email: (f) => `${f} must be a valid email`,
    number: (f) => `${f} must be numeric`,
    alpha: (f) => `${f} must contain only letters`,
    alphanumeric: (f) => `${f} must contain only letters and numbers`,
    boolean: (f) => `${f} must be true or false`,
    date: (f) => `${f} must be a valid date`,
    url: (f) => `${f} must be a valid URL`,
    in: (f, v) => `${f} must be one of: ${v.join(", ")}`,
    equals: (f, v) => `${f} must equal ${v}`,
    password: () => `Password must contain uppercase, lowercase and numbers`,
    pattern: (f) => `${f} does not match the required pattern`,
  },
  pt: {
    required: (f) => `O campo ${f} é obrigatório`,
    min: (f, n) => `O campo ${f} deve ter pelo menos ${n} caracteres`,
    max: (f, n) => `O campo ${f} não pode ter mais de ${n} caracteres`,
    email: (f) => `O campo ${f} deve ser um email válido`,
    number: (f) => `O campo ${f} deve ser numérico`,
    alpha: (f) => `O campo ${f} só pode conter letras`,
    alphanumeric: (f) => `O campo ${f} só pode conter letras e números`,
    boolean: (f) => `O campo ${f} deve ser verdadeiro ou falso`,
    date: (f) => `O campo ${f} deve ser uma data válida`,
    url: (f) => `O campo ${f} deve ser uma URL válida`,
    in: (f, v) => `O campo ${f} deve ser um de: ${v.join(", ")}`,
    equals: (f, v) => `O campo ${f} deve ser igual a ${v}`,
    password: () => `A senha deve conter maiúsculas, minúsculas e números`,
    pattern: (f) => `O campo ${f} não corresponde ao padrão exigido`,
  },
  br: {
    required: (f) => `O campo ${f} é obrigatório`,
    min: (f, n) => `O campo ${f} deve ter pelo menos ${n} caracteres`,
    max: (f, n) => `O campo ${f} não pode ter mais de ${n} caracteres`,
    email: (f) => `O campo ${f} deve ser um email válido`,
    number: (f) => `O campo ${f} deve ser numérico`,
    alpha: (f) => `O campo ${f} só pode conter letras`,
    alphanumeric: (f) => `O campo ${f} só pode conter letras e números`,
    boolean: (f) => `O campo ${f} deve ser verdadeiro ou falso`,
    date: (f) => `O campo ${f} deve ser uma data válida`,
    url: (f) => `O campo ${f} deve ser uma URL válida`,
    in: (f, v) => `O campo ${f} deve ser um de: ${v.join(", ")}`,
    equals: (f, v) => `O campo ${f} deve ser igual a ${v}`,
    password: () => `A senha deve conter maiúsculas, minúsculas e números`,
    pattern: (f) => `O campo ${f} não corresponde ao padrão exigido`,
  },
  fr: {
    required: (f) => `Le champ ${f} est obligatoire`,
    min: (f, n) => `Le champ ${f} doit contenir au moins ${n} caractères`,
    max: (f, n) => `Le champ ${f} ne peut pas contenir plus de ${n} caractères`,
    email: (f) => `Le champ ${f} doit être un email valide`,
    number: (f) => `Le champ ${f} doit être numérique`,
    alpha: (f) => `Le champ ${f} ne peut contenir que des lettres`,
    alphanumeric: (f) => `Le champ ${f} ne peut contenir que des lettres et des chiffres`,
    boolean: (f) => `Le champ ${f} doit être vrai ou faux`,
    date: (f) => `Le champ ${f} doit être une date valide`,
    url: (f) => `Le champ ${f} doit être une URL valide`,
    in: (f, v) => `Le champ ${f} doit être l'un de: ${v.join(", ")}`,
    equals: (f, v) => `Le champ ${f} doit être égal à ${v}`,
    password: () => `Le mot de passe doit contenir des majuscules, des minuscules et des chiffres`,
    pattern: (f) => `Le champ ${f} ne correspond pas au modèle requis`,
  },
};

const validators = {
  isEmpty: (value) => value === undefined || value === null || value === "",
  isEmail: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  isNumeric: (value) => !isNaN(value) && !isNaN(parseFloat(value)),
  isAlpha: (value) => /^[a-zA-Z]+$/.test(value),
  isAlphanumeric: (value) => /^[a-zA-Z0-9]+$/.test(value),
  isBoolean: (value) => value === true || value === false || value === "true" || value === "false",
  isISO8601: (value) => !isNaN(Date.parse(value)),
  isURL: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  isLength: (value, { min, max }) => {
    const len = String(value).length;
    if (min !== undefined && len < min) return false;
    if (max !== undefined && len > max) return false;
    return true;
  },
  isIn: (value, values) => values.includes(value),
  equals: (value, comparison) => value === comparison,
  matches: (value, pattern) => pattern.test(value),
};

/**
 * Comprehensive Validator class for handling multi-language data validation.
 */
class Validator {
  /**
   * Initializes the Validator instance with a schema and optional language settings.
   * @param {Object} schema - Validation rules for each field (e.g., { email: { required: true, email: true } }).
   * @param {string} [lang_default=null] - Default language for error messages (e.g., "en", "es").
   * @param {Object} [messages=null] - Custom message overrides for validation rules.
   */
  constructor(schema, lang_default = null, messages = null) {
    this.schema = schema;
    this.lang_default = lang_default;
    this.messages = messages ? messages : messages_default;
  }

  /**
   * Validates input data (Request, NextRequest, FormData, or plain object) against the schema.
   * @param {Request|FormData|Object} input - The request, form data, or object to validate.
   * @returns {Promise<{success: boolean, error: boolean, errors: Array<{field: string, message: string}>, message: Array<string>}>} Validation results.
   */
  async validate(input) {
    let body = {};
    let lang = this.lang_default;

    if (input) {
      if (!lang) {
        if (input.url && typeof input.url === "string") {
          try {
            const url = new URL(input.url, "http://localhost");
            lang = url.searchParams.get("lang");
          } catch {}
        }
        if (!lang && input.query && typeof input.query === "object") {
          lang = input.query.lang;
        }

        if (!lang && input.cookies) {
          if (typeof input.cookies.get === "function") {
            const c = input.cookies.get("lang");
            lang = c && typeof c === "object" ? c.value : c;
          } else {
            lang = input.cookies.lang;
          }
        }

        if (!lang && input.headers) {
          let cookieHeader = null;
          let acceptHeader = null;

          if (typeof input.headers.get === "function") {
            cookieHeader = input.headers.get("cookie");
            acceptHeader = input.headers.get("accept-language");
          } else {
            cookieHeader = input.headers.cookie;
            acceptHeader = input.headers["accept-language"];
          }

          if (cookieHeader) {
            const match = cookieHeader.match(/(?:^|;\s*)lang=([^;]*)/);
            if (match) {
              lang = decodeURIComponent(match[1]).trim().toLowerCase();
            }
          }

          if (!lang && acceptHeader) {
            lang = acceptHeader.split(",")[0].split("-")[0].trim().toLowerCase();
          }
        }

        if (!lang && typeof input.lang === "string") {
          lang = input.lang;
        }

        if (!lang && input.session && input.session.lang) {
          lang = input.session.lang;
        }

        lang = lang ? lang.trim().toLowerCase() : "es";
      }

      if (typeof input.clone === "function") {
        try {
          const cloned = input.clone();
          let contentType = "";
          if (cloned.headers && typeof cloned.headers.get === "function") {
            contentType = cloned.headers.get("content-type") || "";
          }
          if (contentType.includes("application/json")) {
            body = await cloned.json();
          } else if (
            contentType.includes("multipart/form-data") ||
            contentType.includes("application/x-www-form-urlencoded")
          ) {
            const formData = await cloned.formData();
            body = Object.fromEntries(formData.entries());
          }
        } catch {}
      } else if (typeof FormData !== "undefined" && input instanceof FormData) {
        body = Object.fromEntries(input.entries());
      } else if (input.body && typeof input.body === "object") {
        body = input.body;
      } else if (typeof input === "object") {
        body = input;
      }
    }

    const resolvedLang = this.messages[lang] ? lang : "es";
    const msg = this.messages[resolvedLang];
    const errors = [];
    const messages = [];

    for (const [field, config] of Object.entries(this.schema)) {
      let value = body[field];
      let hasError = false;

      if (config.xss !== false && typeof value === "string") {
        body[field] = xss(value);
        value = body[field];
      }

      if (config.required && validators.isEmpty(value)) {
        const errorMsg = config.messages?.required || msg.required(field);
        messages.push(errorMsg);
        errors.push({ field, message: errorMsg });
        continue;
      }

      if (!validators.isEmpty(value)) {
        if (config.min !== undefined && !validators.isLength(value, { min: config.min })) {
          const errorMsg = config.messages?.min || msg.min(field, config.min);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.max !== undefined && !validators.isLength(value, { max: config.max })) {
          const errorMsg = config.messages?.max || msg.max(field, config.max);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.email && !validators.isEmail(value)) {
          const errorMsg = config.messages?.email || msg.email(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.number && !validators.isNumeric(value)) {
          const errorMsg = config.messages?.number || msg.number(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.alpha && !validators.isAlpha(value)) {
          const errorMsg = config.messages?.alpha || msg.alpha(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.alphanumeric && !validators.isAlphanumeric(value)) {
          const errorMsg = config.messages?.alphanumeric || msg.alphanumeric(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.boolean && !validators.isBoolean(value)) {
          const errorMsg = config.messages?.boolean || msg.boolean(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.date && !validators.isISO8601(value)) {
          const errorMsg = config.messages?.date || msg.date(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.url && !validators.isURL(value)) {
          const errorMsg = config.messages?.url || msg.url(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.in && !validators.isIn(value, config.in)) {
          const errorMsg = config.messages?.in || msg.in(field, config.in);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.equals !== undefined && !validators.equals(value, config.equals)) {
          const errorMsg = config.messages?.equals || msg.equals(field, config.equals);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.password && !validators.matches(value, /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{6,}$/)) {
          const errorMsg = config.messages?.password || msg.password(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }
        if (config.pattern && !validators.matches(value, config.pattern)) {
          const errorMsg = config.messages?.pattern || msg.pattern(field);
          messages.push(errorMsg);
          errors.push({ field, message: errorMsg });
          hasError = true;
        }

        if (!hasError) {
          if (config.number) {
            body[field] = Number(value);
          } else if (config.boolean) {
            body[field] = value === true || value === "true";
          }
        }
      }
    }

    const validatedData = {};
    for (const field of Object.keys(this.schema)) {
      if (body[field] !== undefined) {
        validatedData[field] = body[field];
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: true,
        errors,
        message: messages,
        data: validatedData,
      };
    }

    return {
      success: true,
      error: false,
      errors: [],
      message: [],
      data: validatedData,
    };
  }

  /**
   * Express/Pages Router middleware for automated validation of the request body.
   * Returns a 400 Bad Request response with validation results if errors occur.
   * @returns {Function} Express middleware function (req, res, next).
   */
  middleware() {
    return async (req, res, next) => {
      const result = await this.validate(req);
      if (!result.success) {
        return res.status(400).json(result);
      }
      next();
    };
  }

  /**
   * Express middleware for sanitizing request data against XSS.
   * @returns {Function} Express middleware function (req, res, next).
   */
  static xssMiddleware() {
    return (req, res, next) => {
      if (req.body && typeof req.body === "object") {
        Validator.mutateSanitized(req.body);
      }
      if (req.query && typeof req.query === "object") {
        Validator.mutateSanitized(req.query);
      }
      if (req.params && typeof req.params === "object") {
        Validator.mutateSanitized(req.params);
      }
      next();
    };
  }

  /**
   * Mutates an object in place, sanitizing all string values against XSS.
   * @param {Object} obj - The object to sanitize.
   */
  static mutateSanitized(obj) {
    for (const key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = xss(obj[key]);
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        Validator.mutateSanitized(obj[key]);
      }
    }
  }

  /**
   * Returns a new object with all string values sanitized against XSS.
   * @param {*} obj - The value/object to sanitize.
   * @returns {*} The sanitized value/object.
   */
  static sanitizeObject(obj) {
    if (typeof obj === "string") return xss(obj);

    if (Array.isArray(obj)) {
      return obj.map((item) => Validator.sanitizeObject(item));
    }

    if (typeof obj === "object" && obj !== null) {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = Validator.sanitizeObject(obj[key]);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Creates a safe Server Action wrapper that validates input, handles errors, and returns a consistent response.
   * @param {Object} schema - Validation schema rules.
   * @param {Function} handler - The handler function containing Server Action logic.
   * @returns {Function} An asynchronous function representing the safe Server Action.
   */
  static createSafeAction(schema, handler) {
    const validator = new Validator(schema);
    return async (...args) => {
      const input = args[0];
      let lang = null;
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        lang = cookieStore.get("lng")?.value || cookieStore.get("lang")?.value || null;
      } catch {}

      const actionValidator = new Validator(schema, lang);
      const result = await actionValidator.validate(input);

      if (!result.success) {
        return {
          success: false,
          error: result.message.join(", "),
          errors: result.errors,
        };
      }

      try {
        const actionResult = await handler(result.data, ...args.slice(1));
        return {
          success: true,
          data: actionResult,
          error: null,
          errors: []
        };
      } catch (err) {
        return {
          success: false,
          error: err.message || "An unexpected error occurred",
          errors: []
        };
      }
    };
  }
}

export default Validator;
