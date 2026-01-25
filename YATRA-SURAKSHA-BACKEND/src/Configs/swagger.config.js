import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Yatra Suraksha API',
            version: '1.0.0',
            description: 'API documentation for Yatra Suraksha - Travel Safety Application',
            contact: {
                name: 'Yatra Suraksha Team'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'Firebase ID Token',
                    description: 'Enter your Firebase ID token'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        providers: { 
                            type: 'array', 
                            items: { type: 'string', enum: ['firebase', 'clerk'] },
                            example: ['firebase']
                        },
                        firebaseUID: { type: 'string', example: 'abc123xyz' },
                        clerkID: { type: 'string', example: 'user_xyz123' },
                        name: { type: 'string', example: 'John Doe', maxLength: 100 },
                        email: { type: 'string', format: 'email', example: 'john@example.com' },
                        phoneNumber: { type: 'string', example: '+919876543210' },
                        alternativePhoneNumber: { type: 'string', example: '+919876543211' },
                        whatsappNumber: { type: 'string', example: '+919876543210' },
                        profilePicture: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' },
                        isVerified: { type: 'boolean', example: false },
                        role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
                        gender: { type: 'string', enum: ['male', 'female', 'other'] },
                        dateOfBirth: { type: 'string', format: 'date', example: '1995-06-15' },
                        nationality: { type: 'string', example: 'Indian' },
                        lastLogin: { type: 'string', format: 'date-time' },
                        emergencyContacts: {
                            type: 'array',
                            maxItems: 5,
                            items: { $ref: '#/components/schemas/EmergencyContact' }
                        },
                        healthInfo: { $ref: '#/components/schemas/HealthInfo' },
                        permissions: { $ref: '#/components/schemas/Permissions' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                EmergencyContact: {
                    type: 'object',
                    required: ['name', 'relation', 'phoneNumber'],
                    properties: {
                        name: { type: 'string', example: 'Jane Doe' },
                        relation: { type: 'string', example: 'Spouse' },
                        phoneNumber: { type: 'string', example: '+919876543211' }
                    }
                },
                HealthInfo: {
                    type: 'object',
                    properties: {
                        bloodGroup: { type: 'string', example: 'O+' },
                        allergies: { type: 'array', items: { type: 'string' }, example: ['Peanuts', 'Dust'] },
                        chronicDiseases: { type: 'array', items: { type: 'string' }, example: ['Diabetes'] },
                        medications: { type: 'array', items: { type: 'string' }, example: ['Metformin'] }
                    }
                },
                Permissions: {
                    type: 'object',
                    properties: {
                        allowLocationAccess: { type: 'boolean', default: true },
                        allowNotificationAccess: { type: 'boolean', default: true },
                        allowSmsAccess: { type: 'boolean', default: false }
                    }
                },
                Location: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        userID: { type: 'string', example: '507f1f77bcf86cd799439012' },
                        location: { $ref: '#/components/schemas/GeoPoint' },
                        altitude: { type: 'number', example: 920 },
                        speed: { type: 'number', example: 5.5, description: 'Speed in m/s' },
                        heading: { type: 'number', example: 45, description: 'Direction 0-360 degrees' },
                        accuracy: { type: 'number', example: 10, description: 'GPS accuracy in meters' },
                        batteryLevel: { type: 'number', example: 85, minimum: 0, maximum: 100 },
                        isCharging: { type: 'boolean', example: false },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                },
                GeoPoint: {
                    type: 'object',
                    description: 'GeoJSON Point format',
                    properties: {
                        type: { type: 'string', enum: ['Point'], example: 'Point' },
                        coordinates: {
                            type: 'array',
                            items: { type: 'number' },
                            minItems: 2,
                            maxItems: 2,
                            example: [77.5946, 12.9716],
                            description: '[longitude, latitude]'
                        }
                    }
                },
                Alert: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        userID: { type: 'string', example: '507f1f77bcf86cd799439012' },
                        location: { $ref: '#/components/schemas/GeoPoint' },
                        status: { 
                            type: 'string', 
                            enum: ['active', 'resolved', 'cancelled'],
                            default: 'active'
                        },
                        alertType: { 
                            type: 'string', 
                            enum: ['sos', 'low_battery', 'enter_restricted_geofence', 'exit_safety_geofence']
                        },
                        severity: { 
                            type: 'string', 
                            enum: ['low', 'medium', 'high', 'critical']
                        },
                        description: { type: 'string', maxLength: 500 },
                        resolvedAt: { type: 'string', format: 'date-time' },
                        resolutionNotes: { type: 'string', maxLength: 500 },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 20 },
                        total: { type: 'integer', example: 100 },
                        pages: { type: 'integer', example: 5 }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Error message' }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' },
                        data: { type: 'object' }
                    }
                }
            },
            responses: {
                UnauthorizedError: {
                    description: 'Authentication token missing or invalid',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                success: false,
                                message: 'Authorization token required'
                            }
                        }
                    }
                },
                BadRequestError: {
                    description: 'Invalid request data',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                success: false,
                                message: 'Invalid request data'
                            }
                        }
                    }
                },
                NotFoundError: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                success: false,
                                message: 'Resource not found'
                            }
                        }
                    }
                }
            }
        },
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Users', description: 'User management endpoints' },
            { name: 'Locations', description: 'Location tracking endpoints' },
            { name: 'Alerts', description: 'SOS and alert endpoints' },
            { name: 'Groups', description: 'Group management endpoints' },
            { name: 'Geofences', description: 'Geofence endpoints' },
            { name: 'Trips', description: 'Trip planning endpoints' },
            { name: 'Safety Scores', description: 'Safety score endpoints' }
        ]
    },
    apis: ['./src/Routes/*.js', './src/Controllers/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
