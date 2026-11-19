const notInAudience = /the person is not in the audience of any group the form was sent to/;

export const audienceWords = (message: string, name: string) =>
  notInAudience.test(message) && name !== "" ? `${name} is not in the group this application is for.` : "";
