const { Client } = require('pg')
const {
  /**
   * Recuperamos el esquema esperado
   *
   * Para una primer etapa, se recomienda importar la propiedad
   * "baseFields" reenombrandola a "expectedFields"
   */
  baseFields: expectedFields
} = require('./schema_base')

describe('Test database', () => {
  /**
   * Variables globales usadas por diferentes tests
   */
  let client

  /**
   * Generamos la configuracion con la base de datos y
   * hacemos la consulta sobre los datos de la tabla "users"
   *
   * Se hace en la etapa beforeAll para evitar relizar la operación
   * en cada test
   */
  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL
    })
    await client.connect()
  })

  /**
   * Cerramos la conexion con la base de datos
   */
  afterAll(async () => {
    await client.end()
  })

  /**
   * Validamos el esquema de la base de datos
   */
  describe('Validate database schema', () => {
    /**
     * Variable donde vamos a almacenar los campos
     * recuperados de la base de datos
     */
    let fields
    let result

    /**
     * Generamos un objeto para simplificar el acceso en los test
     */
    beforeAll(async () => {
      /**
       * Consulta para recuperar la información de la tabla
       * "users"
       */
      result = await client.query(
        `SELECT
          column_name, data_type
        FROM
          information_schema.columns
        WHERE
          table_name = $1::text`,
        ['users']
      )

      fields = result.rows.reduce((acc, field) => {
        acc[field.column_name] = field.data_type
        return acc
      }, {})
    })

    describe('Validate fields name', () => {
      /**
       * Conjunto de tests para validar que los campos esperados se
       * encuentren presentes
       */
      test.each(expectedFields)('Validate field $name', ({ name }) => {
        expect(Object.keys(fields)).toContain(name)
      })
    })

    describe('Validate fields type', () => {
      /**
       * Conjunto de tests para validar que los campos esperados sean
       * del tipo esperado
       */
      test.each(expectedFields)('Validate field $name to be type "$type"', ({ name, type }) => {
        expect(fields[name]).toBe(type)
      })
    })
  })

  describe('Validate insertion', () => {
    afterEach(async () => {
      await client.query('TRUNCATE users')
    })

    test('Insert a valid user', async () => {
      let result = await client.query(
        `INSERT INTO
         users (email, username, birthdate, city,  first_name, last_name, password, enabled, updated_at, last_access_time)
         VALUES ('user@example.com', 'user', '2024-01-02', 'La Plata', 'Juan', 'Perez', 'miPassword123', true, NOW(), NOW())`
      )

      expect(result.rowCount).toBe(1)

      result = await client.query(
        'SELECT * FROM users'
      )

      const user = result.rows[0]
      const userCreatedAt = new Date(user.created_at)
      const currentDate = new Date()

      expect(user.email).toBe('user@example.com')
      expect(userCreatedAt.getFullYear()).toBe(currentDate.getFullYear())
    })

    test('Insert a user with an invalid email', async () => {
      const query = `INSERT INTO users
                     (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                     VALUES
                     ('user', 'user', '2024-01-02', 'La Plata', 'Juan', 'Perez', 'miPassword123', true, NOW(), NOW())`
    
      await expect(client.query(query)).rejects.toThrow('users_email_check')
    })
    

    test('Insert a user with an invalid birthdate', async () => {
      const query = `INSERT INTO
                     users (email, username, birthdate, city)
                     VALUES ('user@example.com', 'user', 'invalid_date', 'La Plata')`

      await expect(client.query(query)).rejects.toThrow('invalid input syntax for type date')
    })

    test('Insert a user without city', async () => {
      const query = `INSERT INTO
                     users (email, username, birthdate)
                     VALUES ('user@example.com', 'user', '2024-01-02')`

      await expect(client.query(query)).rejects.toThrow('null value in column "city"')
    })

    //Nuevos tests

    describe('Validate insertion', () => {
      afterEach(async () => {
        await client.query('TRUNCATE users')
      })
    
      // updated_at: no permite null, tiene default now().
      test('Insert a user without updated_at (should use default now())', async () => {
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, last_access_time)
                       VALUES ('user11@example.com', 'user11', '2024-01-02', 'City', 'Juan', 'Perez', 'Pass1234', true, NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
    
        // Consultar que updated_at no sea null y sea cercano a ahora
        const res = await client.query('SELECT updated_at FROM users WHERE email = $1', ['user11@example.com'])
        expect(res.rows[0].updated_at).not.toBeNull()
      })
    
      test('Insert a user with null updated_at should fail', async () => {
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user12@example.com', 'user12', '2024-01-02', 'City', 'Juan', 'Perez', 'Pass1234', true, NULL, NOW())`
        await expect(client.query(query)).rejects.toThrow('null value in column "updated_at"')
      })
    
      // first_name: no null, varchar(50), probar mínimo válido y longitud límite.
      test('Insert a user with first_name length 1 (minimum valid)', async () => {
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user13@example.com', 'user13', '2024-01-02', 'City', 'J', 'Perez', 'Pass1234', true, NOW(), NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
      })
    
      test('Insert a user with first_name length 50 (max valid)', async () => {
        const longName = 'J'.repeat(50)
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user14@example.com', 'user14', '2024-01-02', 'City', '${longName}', 'Perez', 'Pass1234', true, NOW(), NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
      })
    
      // last_name: no null, varchar(50), mismos límites que first_name.
      test('Insert a user with last_name length 1 (minimum valid)', async () => {
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user15@example.com', 'user15', '2024-01-02', 'City', 'Juan', 'P', 'Pass1234', true, NOW(), NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
      })
    
      test('Insert a user with last_name length 50 (max valid)', async () => {
        const longLastName = 'P'.repeat(50)
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user16@example.com', 'user16', '2024-01-02', 'City', 'Juan', '${longLastName}', 'Pass1234', true, NOW(), NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
      })
    
      // password: no null, varchar(255), probar longitud mínima y límite máximo.
      test('Insert a user with password length 1 (minimum valid)', async () => {
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user17@example.com', 'user17', '2024-01-02', 'City', 'Juan', 'Perez', 'p', true, NOW(), NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
      })
    
      test('Insert a user with password length 255 (max valid)', async () => {
        const longPassword = 'p'.repeat(255)
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user18@example.com', 'user18', '2024-01-02', 'City', 'Juan', 'Perez', '${longPassword}', true, NOW(), NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
      })
    
      // enabled: no null, boolean, default true.
      test('Insert a user without enabled (should default to true)', async () => {
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, updated_at, last_access_time)
                       VALUES ('user19@example.com', 'user19', '2024-01-02', 'City', 'Juan', 'Perez', 'Pass1234', NOW(), NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
    
        const res = await client.query('SELECT enabled FROM users WHERE email = $1', ['user19@example.com'])
        expect(res.rows[0].enabled).toBe(true)
      })
    
      test('Insert a user with enabled = false', async () => {
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user20@example.com', 'user20', '2024-01-02', 'City', 'Juan', 'Perez', 'Pass1234', false, NOW(), NOW())`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
      })
    
      // last_access_time: puede ser null.
      test('Insert a user with null last_access_time', async () => {
        const query = `INSERT INTO users
                       (email, username, birthdate, city, first_name, last_name, password, enabled, updated_at, last_access_time)
                       VALUES ('user21@example.com', 'user21', '2024-01-02', 'City', 'Juan', 'Perez', 'Pass1234', true, NOW(), NULL)`
        const result = await client.query(query)
        expect(result.rowCount).toBe(1)
      })
    })
  })
})
